import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../lib/prisma.js";
import { JwtPayload } from "../lib/jwt.js";
import { rateLimitConfigs, keyGenerator } from "../lib/rate-limit.js";

export async function discoveryRoutes(app: FastifyInstance) {
  // Rate limiting for discovery endpoints
  const discoveryRateLimit = {
    config: {
      rateLimit: {
        max: rateLimitConfigs.discovery.max,
        timeWindow: rateLimitConfigs.discovery.timeWindow,
        keyGenerator,
      },
    },
  };
  // All discovery routes require authentication, verification, and profile
  app.addHook("preHandler", async (request, reply) => {
    await app.authenticate(request, reply);
    if (reply.sent) return;
    await app.requireVerified(request, reply);
    if (reply.sent) return;

    // Check if user has a profile
    const { userId } = request.user as JwtPayload;
    const profile = await prisma.profile.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!profile) {
      return reply.status(403).send({
        error: "Profile required",
        code: "PROFILE_REQUIRED",
      });
    }
  });

  // GET /discovery - Get profiles to swipe
  app.get(
    "/",
    discoveryRateLimit,
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { userId } = request.user as JwtPayload;

      // Get IDs of users already swiped by current user
      const swipedUserIds = await prisma.swipe.findMany({
        where: { fromUserId: userId },
        select: { toUserId: true },
      });

      const excludeIds = [userId, ...swipedUserIds.map((s) => s.toUserId)];

      // Get IDs of users who blocked current user or are blocked by current user
      const blocks = await prisma.block.findMany({
        where: {
          OR: [{ blockerId: userId }, { blockedId: userId }],
        },
        select: { blockerId: true, blockedId: true },
      });

      for (const block of blocks) {
        if (!excludeIds.includes(block.blockerId)) {
          excludeIds.push(block.blockerId);
        }
        if (!excludeIds.includes(block.blockedId)) {
          excludeIds.push(block.blockedId);
        }
      }

      // Get random verified users with profiles, excluding self and swiped users
      const profiles = await prisma.profile.findMany({
        where: {
          user: {
            isVerified: true,
            isSuspended: false,
            id: { notIn: excludeIds },
          },
        },
        include: {
          user: {
            select: {
              id: true,
              walletAddress: true,
            },
          },
          photos: {
            orderBy: { position: "asc" },
          },
        },
        take: 20,
      });

      // Shuffle the results for randomness
      const shuffled = profiles.sort(() => Math.random() - 0.5);

      // Calculate age for each profile
      const profilesWithAge = shuffled.map((profile) => {
        const birthDate = new Date(profile.birthDate);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
          age--;
        }

        return {
          userId: profile.user.id,
          walletAddress: profile.user.walletAddress,
          displayName: profile.displayName,
          age,
          bio: profile.bio,
          gender: profile.gender,
          interests: profile.interests,
          city: profile.city,
          country: profile.country,
          photos: profile.photos,
        };
      });

      return reply.send({ profiles: profilesWithAge });
    }
  );

  // POST /discovery/like/:userId - Like a user
  app.post(
    "/like/:userId",
    async (
      request: FastifyRequest<{ Params: { userId: string } }>,
      reply: FastifyReply
    ) => {
      const { userId: currentUserId } = request.user as JwtPayload;
      const { userId: targetUserId } = request.params;

      // Prevent self-like
      if (currentUserId === targetUserId) {
        return reply.status(400).send({ error: "Cannot like yourself" });
      }

      // Check if target user exists and is verified
      const targetUser = await prisma.user.findUnique({
        where: { id: targetUserId },
        select: { isVerified: true, isSuspended: true },
      });

      if (!targetUser || !targetUser.isVerified || targetUser.isSuspended) {
        return reply.status(404).send({ error: "User not found" });
      }

      // Check if already swiped
      const existingSwipe = await prisma.swipe.findUnique({
        where: {
          fromUserId_toUserId: {
            fromUserId: currentUserId,
            toUserId: targetUserId,
          },
        },
      });

      if (existingSwipe) {
        return reply.status(400).send({ error: "Already swiped on this user" });
      }

      // Create swipe
      await prisma.swipe.create({
        data: {
          fromUserId: currentUserId,
          toUserId: targetUserId,
          action: "LIKE",
        },
      });

      // Check for mutual like (match)
      const mutualLike = await prisma.swipe.findFirst({
        where: {
          fromUserId: targetUserId,
          toUserId: currentUserId,
          action: "LIKE",
        },
      });

      let isMatch = false;
      let matchId: string | null = null;

      if (mutualLike) {
        // Create match - order user IDs consistently
        const [userAId, userBId] = [currentUserId, targetUserId].sort();

        // Check if match already exists (shouldn't happen but be safe)
        const existingMatch = await prisma.match.findFirst({
          where: {
            OR: [
              { userAId: currentUserId, userBId: targetUserId },
              { userAId: targetUserId, userBId: currentUserId },
            ],
          },
        });

        if (!existingMatch) {
          const match = await prisma.match.create({
            data: {
              userAId,
              userBId,
              conversation: {
                create: {},
              },
            },
          });

          isMatch = true;
          matchId = match.id;
        }
      }

      return reply.send({
        success: true,
        action: "LIKE",
        isMatch,
        matchId,
      });
    }
  );

  // POST /discovery/pass/:userId - Pass on a user
  app.post(
    "/pass/:userId",
    async (
      request: FastifyRequest<{ Params: { userId: string } }>,
      reply: FastifyReply
    ) => {
      const { userId: currentUserId } = request.user as JwtPayload;
      const { userId: targetUserId } = request.params;

      // Prevent self-pass
      if (currentUserId === targetUserId) {
        return reply.status(400).send({ error: "Cannot pass yourself" });
      }

      // Check if already swiped
      const existingSwipe = await prisma.swipe.findUnique({
        where: {
          fromUserId_toUserId: {
            fromUserId: currentUserId,
            toUserId: targetUserId,
          },
        },
      });

      if (existingSwipe) {
        return reply.status(400).send({ error: "Already swiped on this user" });
      }

      // Create swipe
      await prisma.swipe.create({
        data: {
          fromUserId: currentUserId,
          toUserId: targetUserId,
          action: "PASS",
        },
      });

      return reply.send({
        success: true,
        action: "PASS",
        isMatch: false,
      });
    }
  );
}
