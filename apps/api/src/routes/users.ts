import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { JwtPayload } from "../lib/jwt.js";

// Report reason enum
const REPORT_REASONS = [
  "SPAM",
  "HARASSMENT",
  "INAPPROPRIATE_CONTENT",
  "FAKE_PROFILE",
  "SCAM",
  "OTHER",
] as const;

const reportBodySchema = z.object({
  reason: z.enum(REPORT_REASONS),
  details: z.string().max(500).optional(),
});

export async function usersRoutes(app: FastifyInstance) {
  // All user routes require authentication and verification
  app.addHook("preHandler", async (request, reply) => {
    await app.authenticate(request, reply);
    if (reply.sent) return;
    await app.requireVerified(request, reply);
  });

  // POST /users/:userId/block - Block a user
  app.post(
    "/:userId/block",
    async (
      request: FastifyRequest<{ Params: { userId: string } }>,
      reply: FastifyReply
    ) => {
      const { userId: currentUserId } = request.user as JwtPayload;
      const { userId: targetUserId } = request.params;

      // Can't block yourself
      if (currentUserId === targetUserId) {
        return reply.status(400).send({ error: "Cannot block yourself" });
      }

      // Check if target user exists
      const targetUser = await prisma.user.findUnique({
        where: { id: targetUserId },
      });

      if (!targetUser) {
        return reply.status(404).send({ error: "User not found" });
      }

      // Check if already blocked
      const existingBlock = await prisma.block.findUnique({
        where: {
          blockerId_blockedId: {
            blockerId: currentUserId,
            blockedId: targetUserId,
          },
        },
      });

      if (existingBlock) {
        return reply.status(400).send({ error: "User already blocked" });
      }

      // Create block
      await prisma.block.create({
        data: {
          blockerId: currentUserId,
          blockedId: targetUserId,
        },
      });

      // Deactivate any existing match between the users
      await prisma.match.updateMany({
        where: {
          OR: [
            { userAId: currentUserId, userBId: targetUserId },
            { userAId: targetUserId, userBId: currentUserId },
          ],
        },
        data: { isActive: false },
      });

      return reply.status(201).send({ success: true });
    }
  );

  // DELETE /users/:userId/block - Unblock a user
  app.delete(
    "/:userId/block",
    async (
      request: FastifyRequest<{ Params: { userId: string } }>,
      reply: FastifyReply
    ) => {
      const { userId: currentUserId } = request.user as JwtPayload;
      const { userId: targetUserId } = request.params;

      const block = await prisma.block.findUnique({
        where: {
          blockerId_blockedId: {
            blockerId: currentUserId,
            blockedId: targetUserId,
          },
        },
      });

      if (!block) {
        return reply.status(404).send({ error: "Block not found" });
      }

      await prisma.block.delete({
        where: { id: block.id },
      });

      return reply.send({ success: true });
    }
  );

  // GET /users/:userId/block - Check if user is blocked
  app.get(
    "/:userId/block",
    async (
      request: FastifyRequest<{ Params: { userId: string } }>,
      reply: FastifyReply
    ) => {
      const { userId: currentUserId } = request.user as JwtPayload;
      const { userId: targetUserId } = request.params;

      const block = await prisma.block.findUnique({
        where: {
          blockerId_blockedId: {
            blockerId: currentUserId,
            blockedId: targetUserId,
          },
        },
      });

      return reply.send({ isBlocked: !!block });
    }
  );

  // GET /users/blocked - Get list of blocked users
  app.get(
    "/blocked",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { userId } = request.user as JwtPayload;

      const blocks = await prisma.block.findMany({
        where: { blockerId: userId },
        include: {
          blocked: {
            include: {
              profile: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      const blockedUsers = blocks.map((block) => ({
        userId: block.blocked.id,
        walletAddress: block.blocked.walletAddress,
        displayName: block.blocked.profile?.displayName || "Unknown",
        blockedAt: block.createdAt,
      }));

      return reply.send({ blockedUsers });
    }
  );

  // POST /users/:userId/report - Report a user
  app.post(
    "/:userId/report",
    async (
      request: FastifyRequest<{
        Params: { userId: string };
        Body: { reason: string; details?: string };
      }>,
      reply: FastifyReply
    ) => {
      const { userId: currentUserId } = request.user as JwtPayload;
      const { userId: targetUserId } = request.params;

      // Can't report yourself
      if (currentUserId === targetUserId) {
        return reply.status(400).send({ error: "Cannot report yourself" });
      }

      // Validate request body
      let data;
      try {
        data = reportBodySchema.parse(request.body);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({
            error: "Invalid report data",
            validReasons: REPORT_REASONS,
          });
        }
        throw error;
      }

      // Check if target user exists
      const targetUser = await prisma.user.findUnique({
        where: { id: targetUserId },
      });

      if (!targetUser) {
        return reply.status(404).send({ error: "User not found" });
      }

      // Check for existing recent report (prevent spam reports)
      const recentReport = await prisma.report.findFirst({
        where: {
          reporterId: currentUserId,
          reportedId: targetUserId,
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
          },
        },
      });

      if (recentReport) {
        return reply.status(400).send({
          error: "You have already reported this user recently",
        });
      }

      // Create report
      const report = await prisma.report.create({
        data: {
          reporterId: currentUserId,
          reportedId: targetUserId,
          reason: data.reason,
          details: data.details || null,
        },
      });

      return reply.status(201).send({
        success: true,
        reportId: report.id,
        message: "Report submitted successfully. Our team will review it.",
      });
    }
  );

  // GET /users/report-reasons - Get available report reasons
  app.get(
    "/report-reasons",
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.send({ reasons: REPORT_REASONS });
    }
  );
}
