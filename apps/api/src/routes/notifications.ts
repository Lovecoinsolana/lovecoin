import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { JwtPayload } from "../lib/jwt.js";
import { getVapidPublicKey, pushEnabled } from "../lib/push-notifications.js";

// Schema for subscription registration
const subscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

export async function notificationsRoutes(app: FastifyInstance) {
  // All notification routes require authentication
  app.addHook("preHandler", async (request, reply) => {
    await app.authenticate(request, reply);
  });

  // GET /notifications/vapid-public-key - Get VAPID public key for subscription
  app.get(
    "/vapid-public-key",
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const publicKey = getVapidPublicKey();
      
      if (!publicKey) {
        return reply.status(503).send({ 
          error: "Push notifications not configured",
          enabled: false 
        });
      }

      return reply.send({ 
        publicKey,
        enabled: true 
      });
    }
  );

  // POST /notifications/subscribe - Register a push subscription
  app.post(
    "/subscribe",
    async (
      request: FastifyRequest<{ Body: z.infer<typeof subscriptionSchema> }>,
      reply: FastifyReply
    ) => {
      if (!pushEnabled) {
        return reply.status(503).send({ error: "Push notifications not configured" });
      }

      const { userId } = request.user as JwtPayload;

      // Validate request body
      let data;
      try {
        data = subscriptionSchema.parse(request.body);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: "Invalid subscription data" });
        }
        throw error;
      }

      // Upsert subscription (update if endpoint exists, create if new)
      const subscription = await prisma.pushSubscription.upsert({
        where: { endpoint: data.endpoint },
        update: {
          userId, // Associate with current user
          p256dh: data.keys.p256dh,
          auth: data.keys.auth,
          userAgent: request.headers["user-agent"] || null,
        },
        create: {
          userId,
          endpoint: data.endpoint,
          p256dh: data.keys.p256dh,
          auth: data.keys.auth,
          userAgent: request.headers["user-agent"] || null,
        },
      });

      return reply.status(201).send({ 
        success: true,
        subscriptionId: subscription.id 
      });
    }
  );

  // DELETE /notifications/unsubscribe - Remove a push subscription
  app.delete(
    "/unsubscribe",
    async (
      request: FastifyRequest<{ Body: { endpoint: string } }>,
      reply: FastifyReply
    ) => {
      const { userId } = request.user as JwtPayload;
      const { endpoint } = request.body || {};

      if (!endpoint) {
        return reply.status(400).send({ error: "Endpoint required" });
      }

      // Only delete if subscription belongs to this user
      const deleted = await prisma.pushSubscription.deleteMany({
        where: {
          endpoint,
          userId,
        },
      });

      return reply.send({ 
        success: true,
        deleted: deleted.count > 0 
      });
    }
  );

  // GET /notifications/subscriptions - List user's subscriptions (for debugging)
  app.get(
    "/subscriptions",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { userId } = request.user as JwtPayload;

      const subscriptions = await prisma.pushSubscription.findMany({
        where: { userId },
        select: {
          id: true,
          userAgent: true,
          createdAt: true,
        },
      });

      return reply.send({ 
        count: subscriptions.length,
        subscriptions 
      });
    }
  );
}
