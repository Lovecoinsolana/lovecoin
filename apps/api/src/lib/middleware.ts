import { FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "./prisma.js";
import { JwtPayload } from "./jwt.js";

/**
 * Middleware to require user to be verified
 * Must be used after authenticate middleware
 */
export async function requireVerified(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { userId } = request.user as JwtPayload;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isVerified: true },
  });

  if (!user) {
    return reply.status(401).send({ error: "User not found" });
  }

  if (!user.isVerified) {
    return reply.status(403).send({
      error: "Verification required",
      code: "VERIFICATION_REQUIRED",
    });
  }
}
