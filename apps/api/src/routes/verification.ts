import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { verifyVerificationPayment } from "../lib/solana-rpc.js";
import { config } from "../config.js";
import { JwtPayload } from "../lib/jwt.js";
import { rateLimitConfigs, keyGenerator } from "../lib/rate-limit.js";

const LAMPORTS_PER_SOL = 1_000_000_000;

export async function verificationRoutes(app: FastifyInstance) {
  // All verification routes require authentication
  app.addHook("preHandler", app.authenticate);

  // Strict rate limiting for verification (payment-related)
  const verificationRateLimit = {
    config: {
      rateLimit: {
        max: rateLimitConfigs.verification.max,
        timeWindow: rateLimitConfigs.verification.timeWindow,
        keyGenerator,
      },
    },
  };

  // GET /verification/status
  app.get(
    "/status",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { userId } = request.user as JwtPayload;

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          isVerified: true,
          verificationTx: true,
          verificationAt: true,
        },
      });

      if (!user) {
        return reply.status(404).send({ error: "User not found" });
      }

      return reply.send({
        isVerified: user.isVerified,
        verificationTx: user.verificationTx,
        verificationAt: user.verificationAt,
      });
    }
  );

  // GET /verification/payment-details
  app.get(
    "/payment-details",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { userId } = request.user as JwtPayload;

      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        return reply.status(404).send({ error: "User not found" });
      }

      if (user.isVerified) {
        return reply.status(400).send({ error: "User already verified" });
      }

      if (!config.platformWalletAddress) {
        return reply.status(500).send({ error: "Platform wallet not configured" });
      }

      return reply.send({
        recipientWallet: config.platformWalletAddress,
        amountLamports: config.verificationFeeLamports,
        amountSol: config.verificationFeeLamports / LAMPORTS_PER_SOL,
        memo: `VERIFY:${userId}`,
      });
    }
  );

  // POST /verification/confirm
  app.post(
    "/confirm",
    verificationRateLimit,
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { userId, walletAddress } = request.user as JwtPayload;

      // Get transaction signature from header
      const txSignature = request.headers["x-payment"] as string;

      if (!txSignature) {
        return reply.status(400).send({ error: "Missing X-PAYMENT header" });
      }

      // Validate signature format (base58, ~88 chars)
      if (txSignature.length < 80 || txSignature.length > 100) {
        return reply.status(400).send({ error: "Invalid transaction signature format" });
      }

      // Check if user exists and is not already verified
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        return reply.status(404).send({ error: "User not found" });
      }

      if (user.isVerified) {
        return reply.status(400).send({ error: "User already verified" });
      }

      // Check if this transaction was already used
      const existingUser = await prisma.user.findFirst({
        where: { verificationTx: txSignature },
      });

      if (existingUser) {
        return reply.status(400).send({ error: "Transaction already used for verification" });
      }

      // Verify the transaction on-chain
      const verification = await verifyVerificationPayment(
        txSignature,
        walletAddress,
        userId
      );

      if (!verification.valid) {
        return reply.status(400).send({
          error: "Transaction verification failed",
          details: verification.error,
        });
      }

      // Mark user as verified
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          isVerified: true,
          verificationTx: txSignature,
          verificationAt: new Date(),
        },
      });

      return reply.send({
        success: true,
        isVerified: updatedUser.isVerified,
        verificationTx: updatedUser.verificationTx,
        verificationAt: updatedUser.verificationAt,
      });
    }
  );
}
