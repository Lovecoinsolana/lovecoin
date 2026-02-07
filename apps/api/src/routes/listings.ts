import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { JwtPayload } from "../lib/jwt.js";
import {
  uploadPhoto,
  deletePhoto,
  getPhotoUrl,
  generatePhotoKey,
  isValidImageType,
  validateImageBuffer,
  getExtensionFromMimeType,
  MAX_PHOTO_SIZE,
} from "../lib/s3.js";

const MAX_PHOTOS_PER_LISTING = 5;

const createListingSchema = z.object({
  title: z.string().min(3).max(100),
  description: z.string().max(1000).optional(),
  category: z.enum([
    "ELECTRONICS",
    "FASHION",
    "HOME",
    "SPORTS",
    "VEHICLES",
    "COLLECTIBLES",
    "SERVICES",
    "OTHER",
  ]).default("OTHER"),
  priceSol: z.number().positive().max(1000000),
  city: z.string().max(100).optional(),
  country: z.string().max(100).optional(),
});

const updateListingSchema = z.object({
  title: z.string().min(3).max(100).optional(),
  description: z.string().max(1000).optional(),
  category: z.enum([
    "ELECTRONICS",
    "FASHION",
    "HOME",
    "SPORTS",
    "VEHICLES",
    "COLLECTIBLES",
    "SERVICES",
    "OTHER",
  ]).optional(),
  priceSol: z.number().positive().max(1000000).optional(),
  city: z.string().max(100).optional(),
  country: z.string().max(100).optional(),
  status: z.enum(["ACTIVE", "SOLD"]).optional(),
});

export async function listingsRoutes(app: FastifyInstance) {
  // Public route: GET /listings - Get all active listings
  app.get(
    "/",
    async (
      request: FastifyRequest<{
        Querystring: {
          category?: string;
          city?: string;
          minPrice?: string;
          maxPrice?: string;
          limit?: string;
          offset?: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      const { category, city, minPrice, maxPrice, limit = "20", offset = "0" } = request.query;

      const where: Record<string, unknown> = {
        status: "ACTIVE",
      };

      if (category) {
        where.category = category;
      }

      if (city) {
        where.city = { contains: city, mode: "insensitive" };
      }

      if (minPrice || maxPrice) {
        where.priceSol = {};
        if (minPrice) (where.priceSol as Record<string, number>).gte = parseFloat(minPrice);
        if (maxPrice) (where.priceSol as Record<string, number>).lte = parseFloat(maxPrice);
      }

      const listings = await prisma.listing.findMany({
        where,
        include: {
          seller: {
            include: {
              profile: {
                select: {
                  displayName: true,
                  city: true,
                  country: true,
                },
              },
            },
          },
          photos: {
            orderBy: { position: "asc" },
          },
        },
        orderBy: { createdAt: "desc" },
        take: parseInt(limit),
        skip: parseInt(offset),
      });

      const total = await prisma.listing.count({ where });

      return reply.send({
        listings: listings.map((listing) => ({
          id: listing.id,
          title: listing.title,
          description: listing.description,
          category: listing.category,
          priceSol: listing.priceSol,
          city: listing.city,
          country: listing.country,
          status: listing.status,
          createdAt: listing.createdAt,
          seller: {
            id: listing.seller.id,
            displayName: listing.seller.profile?.displayName || "Anonymous",
            walletAddress: listing.seller.walletAddress,
          },
          photos: listing.photos.map((p) => ({
            id: p.id,
            url: getPhotoUrl(p.storageKey),
            position: p.position,
          })),
        })),
        total,
        hasMore: parseInt(offset) + listings.length < total,
      });
    }
  );

  // Public route: GET /listings/:id - Get single listing
  app.get(
    "/:id",
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      const { id } = request.params;

      const listing = await prisma.listing.findUnique({
        where: { id },
        include: {
          seller: {
            include: {
              profile: {
                select: {
                  displayName: true,
                  city: true,
                  country: true,
                },
              },
            },
          },
          photos: {
            orderBy: { position: "asc" },
          },
        },
      });

      if (!listing) {
        return reply.status(404).send({ error: "Listing not found" });
      }

      return reply.send({
        listing: {
          id: listing.id,
          title: listing.title,
          description: listing.description,
          category: listing.category,
          priceSol: listing.priceSol,
          city: listing.city,
          country: listing.country,
          status: listing.status,
          createdAt: listing.createdAt,
          updatedAt: listing.updatedAt,
          seller: {
            id: listing.seller.id,
            displayName: listing.seller.profile?.displayName || "Anonymous",
            walletAddress: listing.seller.walletAddress,
            city: listing.seller.profile?.city,
            country: listing.seller.profile?.country,
          },
          photos: listing.photos.map((p) => ({
            id: p.id,
            url: getPhotoUrl(p.storageKey),
            position: p.position,
          })),
        },
      });
    }
  );

  // Protected routes - require authentication
  app.register(async (protectedApp) => {
    protectedApp.addHook("preHandler", async (request, reply) => {
      await app.authenticate(request, reply);
      if (reply.sent) return;
      await app.requireVerified(request, reply);
    });

    // GET /listings/my - Get current user's listings
    protectedApp.get(
      "/my",
      async (request: FastifyRequest, reply: FastifyReply) => {
        const { userId } = request.user as JwtPayload;

        const listings = await prisma.listing.findMany({
          where: {
            sellerId: userId,
            status: { not: "DELETED" },
          },
          include: {
            photos: {
              orderBy: { position: "asc" },
            },
          },
          orderBy: { createdAt: "desc" },
        });

        return reply.send({
          listings: listings.map((listing) => ({
            id: listing.id,
            title: listing.title,
            description: listing.description,
            category: listing.category,
            priceSol: listing.priceSol,
            city: listing.city,
            country: listing.country,
            status: listing.status,
            createdAt: listing.createdAt,
            photos: listing.photos.map((p) => ({
              id: p.id,
              url: getPhotoUrl(p.storageKey),
              position: p.position,
            })),
          })),
        });
      }
    );

    // POST /listings - Create new listing
    protectedApp.post(
      "/",
      async (
        request: FastifyRequest<{ Body: z.infer<typeof createListingSchema> }>,
        reply: FastifyReply
      ) => {
        const { userId } = request.user as JwtPayload;

        let data;
        try {
          data = createListingSchema.parse(request.body);
        } catch (error) {
          if (error instanceof z.ZodError) {
            return reply.status(400).send({
              error: "Validation failed",
              details: error.errors,
            });
          }
          throw error;
        }

        const listing = await prisma.listing.create({
          data: {
            sellerId: userId,
            title: data.title,
            description: data.description,
            category: data.category,
            priceSol: data.priceSol,
            city: data.city,
            country: data.country,
          },
        });

        return reply.status(201).send({
          listing: {
            id: listing.id,
            title: listing.title,
            description: listing.description,
            category: listing.category,
            priceSol: listing.priceSol,
            city: listing.city,
            country: listing.country,
            status: listing.status,
            createdAt: listing.createdAt,
          },
        });
      }
    );

    // PATCH /listings/:id - Update listing
    protectedApp.patch(
      "/:id",
      async (
        request: FastifyRequest<{
          Params: { id: string };
          Body: z.infer<typeof updateListingSchema>;
        }>,
        reply: FastifyReply
      ) => {
        const { userId } = request.user as JwtPayload;
        const { id } = request.params;

        const listing = await prisma.listing.findUnique({
          where: { id },
        });

        if (!listing) {
          return reply.status(404).send({ error: "Listing not found" });
        }

        if (listing.sellerId !== userId) {
          return reply.status(403).send({ error: "Not authorized" });
        }

        let data;
        try {
          data = updateListingSchema.parse(request.body);
        } catch (error) {
          if (error instanceof z.ZodError) {
            return reply.status(400).send({
              error: "Validation failed",
              details: error.errors,
            });
          }
          throw error;
        }

        const updated = await prisma.listing.update({
          where: { id },
          data,
          include: {
            photos: {
              orderBy: { position: "asc" },
            },
          },
        });

        return reply.send({
          listing: {
            id: updated.id,
            title: updated.title,
            description: updated.description,
            category: updated.category,
            priceSol: updated.priceSol,
            city: updated.city,
            country: updated.country,
            status: updated.status,
            createdAt: updated.createdAt,
            updatedAt: updated.updatedAt,
            photos: updated.photos.map((p) => ({
              id: p.id,
              url: getPhotoUrl(p.storageKey),
              position: p.position,
            })),
          },
        });
      }
    );

    // DELETE /listings/:id - Delete listing
    protectedApp.delete(
      "/:id",
      async (
        request: FastifyRequest<{ Params: { id: string } }>,
        reply: FastifyReply
      ) => {
        const { userId } = request.user as JwtPayload;
        const { id } = request.params;

        const listing = await prisma.listing.findUnique({
          where: { id },
          include: { photos: true },
        });

        if (!listing) {
          return reply.status(404).send({ error: "Listing not found" });
        }

        if (listing.sellerId !== userId) {
          return reply.status(403).send({ error: "Not authorized" });
        }

        // Delete photos from storage
        for (const photo of listing.photos) {
          try {
            await deletePhoto(photo.storageKey);
          } catch (err) {
            console.error("Failed to delete photo:", err);
          }
        }

        // Soft delete
        await prisma.listing.update({
          where: { id },
          data: { status: "DELETED" },
        });

        return reply.send({ success: true });
      }
    );

    // POST /listings/:id/photos - Upload photo to listing
    protectedApp.post(
      "/:id/photos",
      async (
        request: FastifyRequest<{ Params: { id: string } }>,
        reply: FastifyReply
      ) => {
        const { userId } = request.user as JwtPayload;
        const { id } = request.params;

        const listing = await prisma.listing.findUnique({
          where: { id },
          include: { photos: true },
        });

        if (!listing) {
          return reply.status(404).send({ error: "Listing not found" });
        }

        if (listing.sellerId !== userId) {
          return reply.status(403).send({ error: "Not authorized" });
        }

        if (listing.photos.length >= MAX_PHOTOS_PER_LISTING) {
          return reply.status(400).send({
            error: `Maximum ${MAX_PHOTOS_PER_LISTING} photos allowed`,
          });
        }

        const data = await request.file();

        if (!data) {
          return reply.status(400).send({ error: "No file uploaded" });
        }

        const fileBuffer = await data.toBuffer();

        if (fileBuffer.length > MAX_PHOTO_SIZE) {
          return reply
            .status(400)
            .send({ error: "File too large. Maximum 5MB allowed." });
        }

        if (!isValidImageType(data.mimetype)) {
          return reply.status(400).send({
            error: "Invalid file type. Use JPEG, PNG, WebP, or GIF.",
          });
        }

        const validation = validateImageBuffer(fileBuffer);
        if (!validation.valid) {
          return reply.status(400).send({ error: "Invalid image file" });
        }

        const detectedType = validation.type || data.mimetype;
        const extension = getExtensionFromMimeType(detectedType);
        const storageKey = generatePhotoKey(`listing-${listing.id}`, extension);

        try {
          await uploadPhoto(storageKey, fileBuffer, detectedType);
        } catch (error) {
          console.error("Upload error:", error);
          return reply.status(500).send({ error: "Failed to upload photo" });
        }

        const nextPosition = listing.photos.length + 1;

        const photo = await prisma.listingPhoto.create({
          data: {
            listingId: listing.id,
            storageKey,
            position: nextPosition,
          },
        });

        return reply.status(201).send({
          photo: {
            id: photo.id,
            url: getPhotoUrl(photo.storageKey),
            position: photo.position,
          },
        });
      }
    );

    // DELETE /listings/:id/photos/:photoId - Delete photo from listing
    protectedApp.delete(
      "/:id/photos/:photoId",
      async (
        request: FastifyRequest<{ Params: { id: string; photoId: string } }>,
        reply: FastifyReply
      ) => {
        const { userId } = request.user as JwtPayload;
        const { id, photoId } = request.params;

        const listing = await prisma.listing.findUnique({
          where: { id },
        });

        if (!listing) {
          return reply.status(404).send({ error: "Listing not found" });
        }

        if (listing.sellerId !== userId) {
          return reply.status(403).send({ error: "Not authorized" });
        }

        const photo = await prisma.listingPhoto.findFirst({
          where: { id: photoId, listingId: id },
        });

        if (!photo) {
          return reply.status(404).send({ error: "Photo not found" });
        }

        try {
          await deletePhoto(photo.storageKey);
        } catch (err) {
          console.error("Failed to delete photo from storage:", err);
        }

        await prisma.listingPhoto.delete({
          where: { id: photoId },
        });

        return reply.send({ success: true });
      }
    );
  });
}
