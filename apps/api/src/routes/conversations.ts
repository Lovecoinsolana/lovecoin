import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { JwtPayload } from "../lib/jwt.js";
import { config } from "../config.js";
import { getTransaction } from "../lib/solana-rpc.js";
import { broadcastNewMessage } from "../lib/websocket.js";
import { rateLimitConfigs, keyGenerator } from "../lib/rate-limit.js";

const LAMPORTS_PER_SOL = 1_000_000_000;

const sendMessageSchema = z.object({
  content: z.string().min(1).max(1000),
});

export async function conversationsRoutes(app: FastifyInstance) {
  // All conversation routes require authentication and verification
  app.addHook("preHandler", async (request, reply) => {
    await app.authenticate(request, reply);
    if (reply.sent) return;
    await app.requireVerified(request, reply);
  });

  // Rate limiting for messaging endpoints
  const messagingRateLimit = {
    config: {
      rateLimit: {
        max: rateLimitConfigs.messaging.max,
        timeWindow: rateLimitConfigs.messaging.timeWindow,
        keyGenerator,
      },
    },
  };

  // Helper to check if user is part of conversation
  async function getUserConversation(conversationId: string, userId: string) {
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        match: {
          isActive: true,
          OR: [{ userAId: userId }, { userBId: userId }],
        },
      },
      include: {
        match: true,
      },
    });
    return conversation;
  }

  // GET /conversations - List all conversations
  app.get(
    "/",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { userId } = request.user as JwtPayload;

      const conversations = await prisma.conversation.findMany({
        where: {
          match: {
            isActive: true,
            OR: [{ userAId: userId }, { userBId: userId }],
          },
        },
        include: {
          match: {
            include: {
              userA: {
                include: {
                  profile: true,
                },
              },
              userB: {
                include: {
                  profile: true,
                },
              },
            },
          },
          messages: {
            orderBy: { sentAt: "desc" },
            take: 1,
          },
        },
        orderBy: { lastMessageAt: "desc" },
      });

      const result = conversations.map((conv) => {
        const isUserA = conv.match.userAId === userId;
        const otherUser = isUserA ? conv.match.userB : conv.match.userA;
        const lastMessage = conv.messages[0] || null;

        return {
          id: conv.id,
          matchId: conv.matchId,
          otherUser: {
            userId: otherUser.id,
            displayName: otherUser.profile?.displayName || "Unknown",
          },
          lastMessage: lastMessage
            ? {
                content: lastMessage.contentType === "TEXT" ? lastMessage.content : "[Photo]",
                sentAt: lastMessage.sentAt,
                isFromMe: lastMessage.senderId === userId,
              }
            : null,
          lastMessageAt: conv.lastMessageAt,
        };
      });

      return reply.send({ conversations: result });
    }
  );

  // GET /conversations/:id - Get conversation with messages
  app.get(
    "/:id",
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      const { userId } = request.user as JwtPayload;
      const { id } = request.params;

      const conversation = await getUserConversation(id, userId);

      if (!conversation) {
        return reply.status(404).send({ error: "Conversation not found" });
      }

      // Get other user info
      const isUserA = conversation.match.userAId === userId;
      const otherUserId = isUserA ? conversation.match.userBId : conversation.match.userAId;

      const otherUser = await prisma.user.findUnique({
        where: { id: otherUserId },
        include: {
          profile: true,
        },
      });

      // Get messages
      const messages = await prisma.message.findMany({
        where: { conversationId: id },
        orderBy: { sentAt: "asc" },
        take: 100,
      });

      const formattedMessages = messages.map((msg) => ({
        id: msg.id,
        content: msg.content,
        contentType: msg.contentType,
        senderId: msg.senderId,
        isFromMe: msg.senderId === userId,
        paymentTx: msg.paymentTx,
        sentAt: msg.sentAt,
        readAt: msg.readAt,
      }));

      return reply.send({
        conversation: {
          id: conversation.id,
          matchId: conversation.matchId,
          otherUser: {
            userId: otherUser?.id,
            walletAddress: otherUser?.walletAddress,
            displayName: otherUser?.profile?.displayName || "Unknown",
          },
          messages: formattedMessages,
        },
      });
    }
  );

  // GET /conversations/:id/messages - Get paginated messages
  app.get(
    "/:id/messages",
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Querystring: { cursor?: string; limit?: string };
      }>,
      reply: FastifyReply
    ) => {
      const { userId } = request.user as JwtPayload;
      const { id } = request.params;
      const cursor = request.query.cursor;
      const limit = parseInt(request.query.limit || "50", 10);

      const conversation = await getUserConversation(id, userId);

      if (!conversation) {
        return reply.status(404).send({ error: "Conversation not found" });
      }

      const messages = await prisma.message.findMany({
        where: {
          conversationId: id,
          ...(cursor ? { sentAt: { lt: new Date(cursor) } } : {}),
        },
        orderBy: { sentAt: "desc" },
        take: limit,
      });

      const formattedMessages = messages.map((msg) => ({
        id: msg.id,
        content: msg.content,
        contentType: msg.contentType,
        senderId: msg.senderId,
        isFromMe: msg.senderId === userId,
        paymentTx: msg.paymentTx,
        sentAt: msg.sentAt,
        readAt: msg.readAt,
      }));

      return reply.send({
        messages: formattedMessages.reverse(),
        nextCursor: messages.length === limit ? messages[messages.length - 1]?.sentAt : null,
      });
    }
  );

  // GET /conversations/:id/payment-details - Get payment info for sending message
  app.get(
    "/:id/payment-details",
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      const { userId } = request.user as JwtPayload;
      const { id } = request.params;

      const conversation = await getUserConversation(id, userId);

      if (!conversation) {
        return reply.status(404).send({ error: "Conversation not found" });
      }

      if (!config.platformWalletAddress) {
        return reply.status(500).send({ error: "Platform wallet not configured" });
      }

      return reply.send({
        recipientWallet: config.platformWalletAddress,
        amountLamports: config.messageFeeLamports,
        amountSol: config.messageFeeLamports / LAMPORTS_PER_SOL,
        memo: `MSG:${id}`,
      });
    }
  );

  // POST /conversations/:id/messages - Send a message (FREE - no payment required)
  app.post(
    "/:id/messages",
    messagingRateLimit,
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Body: { content: string };
      }>,
      reply: FastifyReply
    ) => {
      const { userId } = request.user as JwtPayload;
      const { id } = request.params;

      // Validate request body
      let data;
      try {
        data = sendMessageSchema.parse(request.body);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: "Invalid message content" });
        }
        throw error;
      }

      // Check conversation exists and user is part of it
      const conversation = await getUserConversation(id, userId);

      if (!conversation) {
        return reply.status(404).send({ error: "Conversation not found" });
      }

      // Save message (FREE - no payment required)
      const message = await prisma.message.create({
        data: {
          conversationId: id,
          senderId: userId,
          contentType: "TEXT",
          content: data.content,
          paymentTx: "free",
          paymentAmount: BigInt(0),
        },
      });

      // Update conversation last message time
      await prisma.conversation.update({
        where: { id },
        data: { lastMessageAt: new Date() },
      });

      // Broadcast to WebSocket clients
      broadcastNewMessage(id, {
        id: message.id,
        content: message.content ?? "",
        contentType: message.contentType,
        senderId: message.senderId,
        paymentTx: message.paymentTx,
        sentAt: message.sentAt,
      });

      return reply.status(201).send({
        message: {
          id: message.id,
          content: message.content,
          contentType: message.contentType,
          senderId: message.senderId,
          isFromMe: true,
          paymentTx: message.paymentTx,
          sentAt: message.sentAt,
        },
      });
    }
  );

  // PATCH /conversations/:id/read - Mark messages as read
  app.patch(
    "/:id/read",
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      const { userId } = request.user as JwtPayload;
      const { id } = request.params;

      const conversation = await getUserConversation(id, userId);

      if (!conversation) {
        return reply.status(404).send({ error: "Conversation not found" });
      }

      // Mark all messages from other user as read
      await prisma.message.updateMany({
        where: {
          conversationId: id,
          senderId: { not: userId },
          readAt: null,
        },
        data: { readAt: new Date() },
      });

      return reply.send({ success: true });
    }
  );
}
