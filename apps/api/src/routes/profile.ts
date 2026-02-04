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
  MAX_PHOTOS_PER_PROFILE,
} from "../lib/s3.js";

const createProfileSchema = z.object({
  displayName: z.string().min(1).max(50),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD format"),
  bio: z.string().max(500).optional(),
  gender: z.string().max(20).optional(),
  lookingFor: z.array(z.string().max(20)).optional(),
  interests: z.array(z.string().max(50)).optional(),
  city: z.string().max(100).optional(),
  country: z.string().max(100).optional(),
});

const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(50).optional(),
  bio: z.string().max(500).optional(),
  gender: z.string().max(20).optional(),
  lookingFor: z.array(z.string().max(20)).optional(),
  interests: z.array(z.string().max(50)).optional(),
  city: z.string().max(100).optional(),
  country: z.string().max(100).optional(),
});

export async function profileRoutes(app: FastifyInstance) {
  // All profile routes require authentication and verification
  app.addHook("preHandler", async (request, reply) => {
    await app.authenticate(request, reply);
    if (reply.sent) return;
    await app.requireVerified(request, reply);
  });

  // GET /profile - Get current user's profile
  app.get(
    "/",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { userId } = request.user as JwtPayload;

      const profile = await prisma.profile.findUnique({
        where: { userId },
        include: {
          photos: {
            orderBy: { position: "asc" },
          },
        },
      });

      if (!profile) {
        return reply.status(404).send({ error: "Profile not found" });
      }

      return reply.send({
        profile: {
          id: profile.id,
          displayName: profile.displayName,
          birthDate: profile.birthDate.toISOString().split("T")[0],
          bio: profile.bio,
          gender: profile.gender,
          lookingFor: profile.lookingFor,
          interests: profile.interests,
          city: profile.city,
          country: profile.country,
          photos: profile.photos,
          createdAt: profile.createdAt,
          updatedAt: profile.updatedAt,
        },
      });
    }
  );

  // POST /profile - Create new profile
  app.post(
    "/",
    async (
      request: FastifyRequest<{ Body: z.infer<typeof createProfileSchema> }>,
      reply: FastifyReply
    ) => {
      const { userId } = request.user as JwtPayload;

      // Check if profile already exists
      const existingProfile = await prisma.profile.findUnique({
        where: { userId },
      });

      if (existingProfile) {
        return reply.status(400).send({ error: "Profile already exists" });
      }

      // Validate request body
      let data;
      try {
        data = createProfileSchema.parse(request.body);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({
            error: "Validation failed",
            details: error.errors,
          });
        }
        throw error;
      }

      // Validate age (must be 18+)
      const birthDate = new Date(data.birthDate);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }

      if (age < 18) {
        return reply.status(400).send({ error: "Must be 18 or older" });
      }

      // Create profile
      const profile = await prisma.profile.create({
        data: {
          userId,
          displayName: data.displayName,
          birthDate: birthDate,
          bio: data.bio || null,
          gender: data.gender || null,
          lookingFor: data.lookingFor || [],
          interests: data.interests || [],
          city: data.city || null,
          country: data.country || null,
        },
      });

      return reply.status(201).send({
        profile: {
          id: profile.id,
          displayName: profile.displayName,
          birthDate: profile.birthDate.toISOString().split("T")[0],
          bio: profile.bio,
          gender: profile.gender,
          lookingFor: profile.lookingFor,
          interests: profile.interests,
          city: profile.city,
          country: profile.country,
          createdAt: profile.createdAt,
          updatedAt: profile.updatedAt,
        },
      });
    }
  );

  // PATCH /profile - Update existing profile
  app.patch(
    "/",
    async (
      request: FastifyRequest<{ Body: z.infer<typeof updateProfileSchema> }>,
      reply: FastifyReply
    ) => {
      const { userId } = request.user as JwtPayload;

      // Check if profile exists
      const existingProfile = await prisma.profile.findUnique({
        where: { userId },
      });

      if (!existingProfile) {
        return reply.status(404).send({ error: "Profile not found" });
      }

      // Validate request body
      let data;
      try {
        data = updateProfileSchema.parse(request.body);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({
            error: "Validation failed",
            details: error.errors,
          });
        }
        throw error;
      }

      // Build update object (only include provided fields)
      const updateData: Record<string, unknown> = {};
      if (data.displayName !== undefined) updateData.displayName = data.displayName;
      if (data.bio !== undefined) updateData.bio = data.bio || null;
      if (data.gender !== undefined) updateData.gender = data.gender || null;
      if (data.lookingFor !== undefined) updateData.lookingFor = data.lookingFor;
      if (data.interests !== undefined) updateData.interests = data.interests;
      if (data.city !== undefined) updateData.city = data.city || null;
      if (data.country !== undefined) updateData.country = data.country || null;

      // Update profile
      const profile = await prisma.profile.update({
        where: { userId },
        data: updateData,
      });

      return reply.send({
        profile: {
          id: profile.id,
          displayName: profile.displayName,
          birthDate: profile.birthDate.toISOString().split("T")[0],
          bio: profile.bio,
          gender: profile.gender,
          lookingFor: profile.lookingFor,
          interests: profile.interests,
          city: profile.city,
          country: profile.country,
          createdAt: profile.createdAt,
          updatedAt: profile.updatedAt,
        },
      });
    }
  );

  // GET /profile/exists - Quick check if profile exists
  app.get(
    "/exists",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { userId } = request.user as JwtPayload;

      const profile = await prisma.profile.findUnique({
        where: { userId },
        select: { id: true },
      });

      return reply.send({ exists: !!profile });
    }
  );

  // POST /profile/photos - Upload a new photo
  app.post(
    "/photos",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { userId } = request.user as JwtPayload;

      // Get user's profile
      const profile = await prisma.profile.findUnique({
        where: { userId },
        include: { photos: true },
      });

      if (!profile) {
        return reply.status(404).send({ error: "Profile not found. Create a profile first." });
      }

      // Check photo limit
      if (profile.photos.length >= MAX_PHOTOS_PER_PROFILE) {
        return reply.status(400).send({
          error: `Maximum ${MAX_PHOTOS_PER_PROFILE} photos allowed`,
        });
      }

      // Get the uploaded file
      const data = await request.file();

      if (!data) {
        return reply.status(400).send({ error: "No file uploaded" });
      }

      // Validate file type by mime type first (quick check)
      if (!isValidImageType(data.mimetype)) {
        return reply.status(400).send({
          error: "Invalid file type. Allowed: JPEG, PNG, WebP, GIF",
        });
      }

      // Read file buffer
      const chunks: Buffer[] = [];
      let totalSize = 0;

      for await (const chunk of data.file) {
        totalSize += chunk.length;
        if (totalSize > MAX_PHOTO_SIZE) {
          return reply.status(400).send({
            error: `File too large. Maximum size is ${MAX_PHOTO_SIZE / 1024 / 1024}MB`,
          });
        }
        chunks.push(chunk);
      }

      const fileBuffer = Buffer.concat(chunks);

      // Validate file type by magic bytes (security check)
      const validation = validateImageBuffer(fileBuffer);
      if (!validation.valid) {
        return reply.status(400).send({
          error: "Invalid image file. File content does not match a valid image format.",
        });
      }

      // Use detected type for extension (more accurate than declared mime type)
      const detectedType = validation.type || data.mimetype;
      const extension = getExtensionFromMimeType(detectedType);
      const storageKey = generatePhotoKey(profile.id, extension);

      // Upload to S3 (use detected content type for security)
      try {
        await uploadPhoto(storageKey, fileBuffer, detectedType);
      } catch (error) {
        console.error("S3 upload error:", error);
        return reply.status(500).send({ error: "Failed to upload photo" });
      }

      // Determine position (next available)
      const nextPosition = profile.photos.length + 1;
      const isPrimary = profile.photos.length === 0; // First photo is primary

      // Save to database
      const photo = await prisma.profilePhoto.create({
        data: {
          profileId: profile.id,
          storageKey,
          position: nextPosition,
          isPrimary,
        },
      });

      return reply.status(201).send({
        photo: {
          id: photo.id,
          url: getPhotoUrl(photo.storageKey),
          position: photo.position,
          isPrimary: photo.isPrimary,
          createdAt: photo.createdAt,
        },
      });
    }
  );

  // DELETE /profile/photos/:id - Delete a photo
  app.delete(
    "/photos/:id",
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      const { userId } = request.user as JwtPayload;
      const { id } = request.params;

      // Get user's profile
      const profile = await prisma.profile.findUnique({
        where: { userId },
      });

      if (!profile) {
        return reply.status(404).send({ error: "Profile not found" });
      }

      // Get the photo
      const photo = await prisma.profilePhoto.findFirst({
        where: {
          id,
          profileId: profile.id,
        },
      });

      if (!photo) {
        return reply.status(404).send({ error: "Photo not found" });
      }

      // Delete from S3
      try {
        await deletePhoto(photo.storageKey);
      } catch (error) {
        console.error("S3 delete error:", error);
        // Continue with database delete even if S3 fails
      }

      // Delete from database
      await prisma.profilePhoto.delete({
        where: { id },
      });

      // If deleted photo was primary, make the first remaining photo primary
      if (photo.isPrimary) {
        const remainingPhotos = await prisma.profilePhoto.findMany({
          where: { profileId: profile.id },
          orderBy: { position: "asc" },
          take: 1,
        });

        if (remainingPhotos.length > 0) {
          await prisma.profilePhoto.update({
            where: { id: remainingPhotos[0].id },
            data: { isPrimary: true },
          });
        }
      }

      // Reorder remaining photos
      const remainingPhotos = await prisma.profilePhoto.findMany({
        where: { profileId: profile.id },
        orderBy: { position: "asc" },
      });

      for (let i = 0; i < remainingPhotos.length; i++) {
        if (remainingPhotos[i].position !== i + 1) {
          await prisma.profilePhoto.update({
            where: { id: remainingPhotos[i].id },
            data: { position: i + 1 },
          });
        }
      }

      return reply.send({ success: true });
    }
  );

  // PATCH /profile/photos/:id/position - Update photo position
  app.patch(
    "/photos/:id/position",
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Body: { position: number };
      }>,
      reply: FastifyReply
    ) => {
      const { userId } = request.user as JwtPayload;
      const { id } = request.params;
      const { position: newPosition } = request.body as { position: number };

      if (
        !newPosition ||
        typeof newPosition !== "number" ||
        newPosition < 1 ||
        newPosition > MAX_PHOTOS_PER_PROFILE
      ) {
        return reply.status(400).send({
          error: `Position must be between 1 and ${MAX_PHOTOS_PER_PROFILE}`,
        });
      }

      // Get user's profile
      const profile = await prisma.profile.findUnique({
        where: { userId },
        include: { photos: { orderBy: { position: "asc" } } },
      });

      if (!profile) {
        return reply.status(404).send({ error: "Profile not found" });
      }

      // Get the photo
      const photo = profile.photos.find((p) => p.id === id);

      if (!photo) {
        return reply.status(404).send({ error: "Photo not found" });
      }

      if (newPosition > profile.photos.length) {
        return reply.status(400).send({
          error: `Position ${newPosition} is out of range. Max: ${profile.photos.length}`,
        });
      }

      const oldPosition = photo.position;

      if (oldPosition === newPosition) {
        return reply.send({ success: true });
      }

      // Reorder photos
      if (newPosition < oldPosition) {
        // Moving up: increment positions of photos between new and old
        await prisma.profilePhoto.updateMany({
          where: {
            profileId: profile.id,
            position: { gte: newPosition, lt: oldPosition },
          },
          data: { position: { increment: 1 } },
        });
      } else {
        // Moving down: decrement positions of photos between old and new
        await prisma.profilePhoto.updateMany({
          where: {
            profileId: profile.id,
            position: { gt: oldPosition, lte: newPosition },
          },
          data: { position: { decrement: 1 } },
        });
      }

      // Update the moved photo's position
      await prisma.profilePhoto.update({
        where: { id },
        data: { position: newPosition },
      });

      // Get updated photos
      const updatedPhotos = await prisma.profilePhoto.findMany({
        where: { profileId: profile.id },
        orderBy: { position: "asc" },
      });

      return reply.send({
        photos: updatedPhotos.map((p) => ({
          id: p.id,
          url: getPhotoUrl(p.storageKey),
          position: p.position,
          isPrimary: p.isPrimary,
        })),
      });
    }
  );

  // PATCH /profile/photos/:id/primary - Set photo as primary
  app.patch(
    "/photos/:id/primary",
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      const { userId } = request.user as JwtPayload;
      const { id } = request.params;

      // Get user's profile
      const profile = await prisma.profile.findUnique({
        where: { userId },
      });

      if (!profile) {
        return reply.status(404).send({ error: "Profile not found" });
      }

      // Get the photo
      const photo = await prisma.profilePhoto.findFirst({
        where: {
          id,
          profileId: profile.id,
        },
      });

      if (!photo) {
        return reply.status(404).send({ error: "Photo not found" });
      }

      // Update all photos to not primary
      await prisma.profilePhoto.updateMany({
        where: { profileId: profile.id },
        data: { isPrimary: false },
      });

      // Set the selected photo as primary
      await prisma.profilePhoto.update({
        where: { id },
        data: { isPrimary: true },
      });

      return reply.send({ success: true });
    }
  );
}
