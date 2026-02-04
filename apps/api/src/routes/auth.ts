import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { generateChallenge, verifyChallenge } from "../lib/challenge.js";
import { verifySignature, isValidWalletAddress } from "../lib/solana.js";
import { JwtPayload } from "../lib/jwt.js";
import { rateLimitConfigs, keyGenerator } from "../lib/rate-limit.js";

const challengeQuerySchema = z.object({
  wallet: z.string().min(32).max(44),
});

const verifyBodySchema = z.object({
  wallet: z.string().min(32).max(44),
  signature: z.string().min(64),
  nonce: z.string().length(64),
});

export async function authRoutes(app: FastifyInstance) {
  const authRateLimit = {
    config: {
      rateLimit: {
        max: rateLimitConfigs.auth.max,
        timeWindow: rateLimitConfigs.auth.timeWindow,
        keyGenerator,
      },
    },
  };

  // GET /auth/challenge?wallet=<address>
  app.get(
    "/challenge",
    authRateLimit,
    async (
      request: FastifyRequest<{ Querystring: { wallet: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const { wallet } = challengeQuerySchema.parse(request.query);

        if (!isValidWalletAddress(wallet)) {
          return reply.status(400).send({ error: "Invalid wallet address" });
        }

        const { message, nonce } = generateChallenge(wallet);

        return reply.send({ message, nonce });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: "Invalid request parameters" });
        }
        throw error;
      }
    }
  );

  // POST /auth/verify
  app.post(
    "/verify",
    authRateLimit,
    async (
      request: FastifyRequest<{
        Body: { wallet: string; signature: string; nonce: string };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { wallet, signature, nonce } = verifyBodySchema.parse(
          request.body
        );

        if (!isValidWalletAddress(wallet)) {
          return reply.status(400).send({ error: "Invalid wallet address" });
        }

        // Verify the challenge exists and is valid
        const challengeResult = verifyChallenge(nonce, wallet);
        if (!challengeResult.valid || !challengeResult.message) {
          return reply
            .status(400)
            .send({ error: "Invalid or expired challenge" });
        }

        // Verify the signature
        const isValid = verifySignature(
          challengeResult.message,
          signature,
          wallet
        );

        if (!isValid) {
          return reply.status(401).send({ error: "Invalid signature" });
        }

        // Find or create user
        let user = await prisma.user.findUnique({
          where: { walletAddress: wallet },
        });

        if (!user) {
          user = await prisma.user.create({
            data: {
              walletAddress: wallet,
            },
          });
        }

        // Update last active
        await prisma.user.update({
          where: { id: user.id },
          data: { lastActiveAt: new Date() },
        });

        // Generate JWT
        const payload: JwtPayload = {
          userId: user.id,
          walletAddress: user.walletAddress,
        };

        const token = app.jwt.sign(payload);

        return reply.send({
          token,
          user: {
            id: user.id,
            walletAddress: user.walletAddress,
            isVerified: user.isVerified,
          },
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: "Invalid request body" });
        }
        throw error;
      }
    }
  );

  // GET /auth/session - Check current session
  app.get(
    "/session",
    {
      preHandler: [app.authenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const payload = request.user as JwtPayload;

      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
      });

      if (!user) {
        return reply.status(401).send({ error: "User not found" });
      }

      return reply.send({
        valid: true,
        user: {
          id: user.id,
          walletAddress: user.walletAddress,
          isVerified: user.isVerified,
        },
      });
    }
  );

  // POST /auth/logout - Logout (client-side token removal, but we can track)
  app.post("/logout", async (request: FastifyRequest, reply: FastifyReply) => {
    // JWT is stateless, so logout is handled client-side
    // In production, you might want to add token to a blacklist
    return reply.send({ success: true });
  });
}
