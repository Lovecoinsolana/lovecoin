import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { prisma } from "../lib/prisma.js";
import { JwtPayload } from "../lib/jwt.js";
import { config } from "../config.js";
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

const PLATFORM_FEE_PERCENT = config.marketplaceFeePercent;

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

    // POST /listings/:id/purchase - Record a purchase after payment
    protectedApp.post(
      "/:id/purchase",
      async (
        request: FastifyRequest<{
          Params: { id: string };
          Body: { txSignature: string };
        }>,
        reply: FastifyReply
      ) => {
        const { userId } = request.user as JwtPayload;
        const { id } = request.params;
        const { txSignature } = request.body;

        if (!txSignature) {
          return reply.status(400).send({ error: "Transaction signature required" });
        }

        // Get listing with seller info
        const listing = await prisma.listing.findUnique({
          where: { id },
          include: {
            seller: true,
            purchase: true,
          },
        });

        if (!listing) {
          return reply.status(404).send({ error: "Listing not found" });
        }

        if (listing.status !== "ACTIVE") {
          return reply.status(400).send({ error: "Listing is no longer available" });
        }

        if (listing.sellerId === userId) {
          return reply.status(400).send({ error: "Cannot purchase your own listing" });
        }

        if (listing.purchase) {
          return reply.status(400).send({ error: "Listing already purchased" });
        }

        // Verify the transaction on Solana
        const connection = new Connection(config.solanaRpcUrl, "confirmed");

        try {
          const tx = await connection.getTransaction(txSignature, {
            commitment: "confirmed",
            maxSupportedTransactionVersion: 0,
          });

          if (!tx) {
            return reply.status(400).send({ error: "Transaction not found or not confirmed" });
          }

          if (tx.meta?.err) {
            return reply.status(400).send({ error: "Transaction failed" });
          }

          // Verify the transaction transferred SOL to the seller
          const sellerPubkey = new PublicKey(listing.seller.walletAddress);
          const platformPubkey = new PublicKey(config.platformWalletAddress);

          const preBalances = tx.meta?.preBalances || [];
          const postBalances = tx.meta?.postBalances || [];
          const accountKeys = tx.transaction.message.getAccountKeys().staticAccountKeys;

          let sellerReceived = 0;
          let platformReceived = 0;

          for (let i = 0; i < accountKeys.length; i++) {
            const pubkey = accountKeys[i];
            const balanceChange = (postBalances[i] || 0) - (preBalances[i] || 0);

            if (pubkey.equals(sellerPubkey) && balanceChange > 0) {
              sellerReceived = balanceChange;
            }
            if (pubkey.equals(platformPubkey) && balanceChange > 0) {
              platformReceived = balanceChange;
            }
          }

          const expectedTotal = listing.priceSol * LAMPORTS_PER_SOL;
          const expectedPlatformFee = expectedTotal * (PLATFORM_FEE_PERCENT / 100);
          const expectedSellerAmount = expectedTotal - expectedPlatformFee;

          // Allow 1% tolerance for rounding
          const tolerance = 0.01;
          const sellerOk = Math.abs(sellerReceived - expectedSellerAmount) / expectedSellerAmount < tolerance;
          const platformOk = Math.abs(platformReceived - expectedPlatformFee) / expectedPlatformFee < tolerance;

          if (!sellerOk || !platformOk) {
            return reply.status(400).send({
              error: "Transaction amounts do not match listing price",
              expected: {
                sellerAmount: expectedSellerAmount / LAMPORTS_PER_SOL,
                platformFee: expectedPlatformFee / LAMPORTS_PER_SOL,
              },
              received: {
                sellerAmount: sellerReceived / LAMPORTS_PER_SOL,
                platformFee: platformReceived / LAMPORTS_PER_SOL,
              },
            });
          }

          // Record the purchase
          const purchase = await prisma.$transaction(async (tx) => {
            // Create purchase record
            const purchase = await tx.purchase.create({
              data: {
                listingId: listing.id,
                buyerId: userId,
                sellerId: listing.sellerId,
                priceSol: listing.priceSol,
                platformFeeSol: expectedPlatformFee / LAMPORTS_PER_SOL,
                sellerAmountSol: expectedSellerAmount / LAMPORTS_PER_SOL,
                txSignature,
              },
            });

            // Update listing status to SOLD
            await tx.listing.update({
              where: { id: listing.id },
              data: { status: "SOLD" },
            });

            return purchase;
          });

          return reply.status(201).send({
            success: true,
            purchase: {
              id: purchase.id,
              listingId: purchase.listingId,
              priceSol: purchase.priceSol,
              platformFeeSol: purchase.platformFeeSol,
              sellerAmountSol: purchase.sellerAmountSol,
              txSignature: purchase.txSignature,
              purchasedAt: purchase.purchasedAt,
            },
          });
        } catch (error) {
          console.error("Error verifying transaction:", error);
          return reply.status(500).send({ error: "Failed to verify transaction" });
        }
      }
    );

    // POST /listings/:id/contact - Create or get conversation with seller
    protectedApp.post(
      "/:id/contact",
      async (
        request: FastifyRequest<{ Params: { id: string } }>,
        reply: FastifyReply
      ) => {
        const { userId } = request.user as JwtPayload;
        const { id } = request.params;

        const listing = await prisma.listing.findUnique({
          where: { id },
          include: {
            seller: {
              include: {
                profile: {
                  select: { displayName: true },
                },
              },
            },
          },
        });

        if (!listing) {
          return reply.status(404).send({ error: "Listing not found" });
        }

        if (listing.sellerId === userId) {
          return reply.status(400).send({ error: "Cannot message yourself" });
        }

        // Check if there's already a match/conversation between these users
        const existingMatch = await prisma.match.findFirst({
          where: {
            OR: [
              { userAId: userId, userBId: listing.sellerId },
              { userAId: listing.sellerId, userBId: userId },
            ],
          },
          include: { conversation: true },
        });

        if (existingMatch?.conversation) {
          return reply.send({
            conversationId: existingMatch.conversation.id,
            isNew: false,
            seller: {
              id: listing.seller.id,
              displayName: listing.seller.profile?.displayName || "Anonymous",
            },
          });
        }

        // Create a new match and conversation for marketplace contact
        const [userA, userB] = [userId, listing.sellerId].sort();

        const match = await prisma.match.create({
          data: {
            userAId: userA,
            userBId: userB,
            conversation: {
              create: {},
            },
          },
          include: { conversation: true },
        });

        return reply.status(201).send({
          conversationId: match.conversation!.id,
          isNew: true,
          seller: {
            id: listing.seller.id,
            displayName: listing.seller.profile?.displayName || "Anonymous",
          },
        });
      }
    );

    // GET /listings/purchases - Get user's purchase history
    protectedApp.get(
      "/purchases",
      async (request: FastifyRequest, reply: FastifyReply) => {
        const { userId } = request.user as JwtPayload;

        const purchases = await prisma.purchase.findMany({
          where: { buyerId: userId },
          include: {
            listing: {
              include: {
                photos: {
                  orderBy: { position: "asc" },
                  take: 1,
                },
                seller: {
                  include: {
                    profile: {
                      select: { displayName: true },
                    },
                  },
                },
              },
            },
          },
          orderBy: { purchasedAt: "desc" },
        });

        return reply.send({
          purchases: purchases.map((p) => ({
            id: p.id,
            listing: {
              id: p.listing.id,
              title: p.listing.title,
              photo: p.listing.photos[0]
                ? getPhotoUrl(p.listing.photos[0].storageKey)
                : null,
              seller: {
                id: p.listing.seller.id,
                displayName: p.listing.seller.profile?.displayName || "Anonymous",
              },
            },
            priceSol: p.priceSol,
            txSignature: p.txSignature,
            purchasedAt: p.purchasedAt,
          })),
        });
      }
    );

    // GET /listings/sales - Get user's sales history
    protectedApp.get(
      "/sales",
      async (request: FastifyRequest, reply: FastifyReply) => {
        const { userId } = request.user as JwtPayload;

        const sales = await prisma.purchase.findMany({
          where: { sellerId: userId },
          include: {
            listing: {
              include: {
                photos: {
                  orderBy: { position: "asc" },
                  take: 1,
                },
              },
            },
            buyer: {
              include: {
                profile: {
                  select: { displayName: true },
                },
              },
            },
          },
          orderBy: { purchasedAt: "desc" },
        });

        return reply.send({
          sales: sales.map((s) => ({
            id: s.id,
            listing: {
              id: s.listing.id,
              title: s.listing.title,
              photo: s.listing.photos[0]
                ? getPhotoUrl(s.listing.photos[0].storageKey)
                : null,
            },
            buyer: {
              id: s.buyer.id,
              displayName: s.buyer.profile?.displayName || "Anonymous",
            },
            priceSol: s.priceSol,
            sellerAmountSol: s.sellerAmountSol,
            platformFeeSol: s.platformFeeSol,
            txSignature: s.txSignature,
            purchasedAt: s.purchasedAt,
          })),
        });
      }
    );
  });
}
