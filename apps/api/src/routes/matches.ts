import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../lib/prisma.js";
import { JwtPayload } from "../lib/jwt.js";

export async function matchesRoutes(app: FastifyInstance) {
  // All match routes require authentication and verification
  app.addHook("preHandler", async (request, reply) => {
    await app.authenticate(request, reply);
    if (reply.sent) return;
    await app.requireVerified(request, reply);
  });

  // GET /matches - Get all matches for current user
  app.get(
    "/",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { userId } = request.user as JwtPayload;

      // Get all matches where current user is involved
      const matches = await prisma.match.findMany({
        where: {
          isActive: true,
          OR: [{ userAId: userId }, { userBId: userId }],
        },
        include: {
          userA: {
            include: {
              profile: {
                include: {
                  photos: {
                    where: { isPrimary: true },
                    take: 1,
                  },
                },
              },
            },
          },
          userB: {
            include: {
              profile: {
                include: {
                  photos: {
                    where: { isPrimary: true },
                    take: 1,
                  },
                },
              },
            },
          },
          conversation: {
            include: {
              messages: {
                orderBy: { sentAt: "desc" },
                take: 1,
              },
            },
          },
        },
        orderBy: { matchedAt: "desc" },
      });

      // Transform matches to return other user's info
      const transformedMatches = matches.map((match) => {
        const isUserA = match.userAId === userId;
        const otherUser = isUserA ? match.userB : match.userA;
        const otherProfile = otherUser.profile;

        // Calculate age
        let age: number | null = null;
        if (otherProfile?.birthDate) {
          const birthDate = new Date(otherProfile.birthDate);
          const today = new Date();
          age = today.getFullYear() - birthDate.getFullYear();
          const monthDiff = today.getMonth() - birthDate.getMonth();
          if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
          }
        }

        // Get last message
        const lastMessage = match.conversation?.messages[0] || null;

        return {
          matchId: match.id,
          conversationId: match.conversation?.id || null,
          matchedAt: match.matchedAt,
          otherUser: {
            userId: otherUser.id,
            walletAddress: otherUser.walletAddress,
            displayName: otherProfile?.displayName || "Unknown",
            age,
            bio: otherProfile?.bio || null,
            city: otherProfile?.city || null,
            country: otherProfile?.country || null,
            primaryPhoto: otherProfile?.photos[0]?.storageKey || null,
          },
          lastMessage: lastMessage
            ? {
                id: lastMessage.id,
                content:
                  lastMessage.contentType === "TEXT"
                    ? lastMessage.content
                    : "[Photo]",
                sentAt: lastMessage.sentAt,
                isFromMe: lastMessage.senderId === userId,
              }
            : null,
        };
      });

      return reply.send({ matches: transformedMatches });
    }
  );

  // GET /matches/:matchId - Get single match details
  app.get(
    "/:matchId",
    async (
      request: FastifyRequest<{ Params: { matchId: string } }>,
      reply: FastifyReply
    ) => {
      const { userId } = request.user as JwtPayload;
      const { matchId } = request.params;

      const match = await prisma.match.findFirst({
        where: {
          id: matchId,
          isActive: true,
          OR: [{ userAId: userId }, { userBId: userId }],
        },
        include: {
          userA: {
            include: {
              profile: {
                include: {
                  photos: {
                    orderBy: { position: "asc" },
                  },
                },
              },
            },
          },
          userB: {
            include: {
              profile: {
                include: {
                  photos: {
                    orderBy: { position: "asc" },
                  },
                },
              },
            },
          },
          conversation: true,
        },
      });

      if (!match) {
        return reply.status(404).send({ error: "Match not found" });
      }

      const isUserA = match.userAId === userId;
      const otherUser = isUserA ? match.userB : match.userA;
      const otherProfile = otherUser.profile;

      // Calculate age
      let age: number | null = null;
      if (otherProfile?.birthDate) {
        const birthDate = new Date(otherProfile.birthDate);
        const today = new Date();
        age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
          age--;
        }
      }

      return reply.send({
        match: {
          matchId: match.id,
          conversationId: match.conversation?.id || null,
          matchedAt: match.matchedAt,
          otherUser: {
            userId: otherUser.id,
            walletAddress: otherUser.walletAddress,
            displayName: otherProfile?.displayName || "Unknown",
            age,
            bio: otherProfile?.bio || null,
            gender: otherProfile?.gender || null,
            interests: otherProfile?.interests || [],
            city: otherProfile?.city || null,
            country: otherProfile?.country || null,
            photos: otherProfile?.photos || [],
          },
        },
      });
    }
  );

  // DELETE /matches/:matchId - Unmatch
  app.delete(
    "/:matchId",
    async (
      request: FastifyRequest<{ Params: { matchId: string } }>,
      reply: FastifyReply
    ) => {
      const { userId } = request.user as JwtPayload;
      const { matchId } = request.params;

      const match = await prisma.match.findFirst({
        where: {
          id: matchId,
          OR: [{ userAId: userId }, { userBId: userId }],
        },
      });

      if (!match) {
        return reply.status(404).send({ error: "Match not found" });
      }

      // Soft delete - mark as inactive
      await prisma.match.update({
        where: { id: matchId },
        data: { isActive: false },
      });

      return reply.send({ success: true });
    }
  );
}
