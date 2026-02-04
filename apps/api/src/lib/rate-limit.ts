import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import rateLimit from "@fastify/rate-limit";

// Rate limit configurations for different endpoint types
export const rateLimitConfigs = {
  // Auth endpoints - strict limits to prevent brute force
  auth: {
    max: 10, // 10 requests
    timeWindow: "1 minute",
    errorResponseBuilder: () => ({
      error: "Too many authentication attempts. Please try again later.",
      retryAfter: 60,
    }),
  },

  // Verification endpoints - very strict (involves payments)
  verification: {
    max: 5, // 5 requests
    timeWindow: "1 minute",
    errorResponseBuilder: () => ({
      error: "Too many verification attempts. Please try again later.",
      retryAfter: 60,
    }),
  },

  // Messaging endpoints - moderate limits
  messaging: {
    max: 30, // 30 messages
    timeWindow: "1 minute",
    errorResponseBuilder: () => ({
      error: "Message rate limit exceeded. Please slow down.",
      retryAfter: 60,
    }),
  },

  // Discovery endpoints - generous but limited
  discovery: {
    max: 60, // 60 requests (profiles + swipes)
    timeWindow: "1 minute",
    errorResponseBuilder: () => ({
      error: "Too many requests. Please slow down.",
      retryAfter: 60,
    }),
  },

  // General API - fallback limit
  general: {
    max: 100, // 100 requests
    timeWindow: "1 minute",
    errorResponseBuilder: () => ({
      error: "Rate limit exceeded. Please try again later.",
      retryAfter: 60,
    }),
  },
};

// Key generator based on user ID or IP
export function keyGenerator(request: FastifyRequest): string {
  // Use user ID if authenticated, otherwise IP
  const user = request.user as { userId?: string } | undefined;
  if (user?.userId) {
    return `user:${user.userId}`;
  }
  return `ip:${request.ip}`;
}

// Register global rate limiting
export async function registerRateLimiting(app: FastifyInstance) {
  await app.register(rateLimit, {
    global: true,
    max: rateLimitConfigs.general.max,
    timeWindow: rateLimitConfigs.general.timeWindow,
    keyGenerator,
    errorResponseBuilder: rateLimitConfigs.general.errorResponseBuilder,
    addHeadersOnExceeding: {
      "x-ratelimit-limit": true,
      "x-ratelimit-remaining": true,
      "x-ratelimit-reset": true,
    },
    addHeaders: {
      "x-ratelimit-limit": true,
      "x-ratelimit-remaining": true,
      "x-ratelimit-reset": true,
      "retry-after": true,
    },
  });
}

// Helper to create route-specific rate limit config
export function createRouteRateLimit(
  configKey: keyof typeof rateLimitConfigs
) {
  const config = rateLimitConfigs[configKey];
  return {
    config: {
      rateLimit: {
        max: config.max,
        timeWindow: config.timeWindow,
        keyGenerator,
        errorResponseBuilder: config.errorResponseBuilder,
      },
    },
  };
}
