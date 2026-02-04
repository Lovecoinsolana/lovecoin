import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import websocket from "@fastify/websocket";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import * as path from "path";
import * as fs from "fs";
import { config } from "./config.js";
import { authRoutes } from "./routes/auth.js";
import { verificationRoutes } from "./routes/verification.js";
import { profileRoutes } from "./routes/profile.js";
import { discoveryRoutes } from "./routes/discovery.js";
import { matchesRoutes } from "./routes/matches.js";
import { conversationsRoutes } from "./routes/conversations.js";
import { usersRoutes } from "./routes/users.js";
import { requireVerified } from "./lib/middleware.js";
import { setupWebSocket } from "./lib/websocket.js";
import { registerRateLimiting } from "./lib/rate-limit.js";

const app = Fastify({
  logger: true,
});

// Register CORS
await app.register(cors, {
  origin: true,
  credentials: true,
});

// Register JWT
await app.register(jwt, {
  secret: config.jwtSecret,
  sign: {
    expiresIn: config.jwtExpiresIn,
  },
});

// Register WebSocket
await app.register(websocket);

// Register Multipart (for file uploads)
await app.register(multipart, {
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max
    files: 1, // 1 file per request
  },
});

// Register Static file serving for local uploads (development)
const uploadsDir = path.join(process.cwd(), "uploads");
if (!process.env.S3_ACCESS_KEY_ID) {
  // Only serve static files if using local storage
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  await app.register(fastifyStatic, {
    root: uploadsDir,
    prefix: "/uploads/",
    decorateReply: false,
  });
}

// Register Rate Limiting
await registerRateLimiting(app);

// Add authenticate decorator
app.decorate("authenticate", async function (request: any, reply: any) {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.status(401).send({ error: "Unauthorized" });
  }
});

// Add requireVerified decorator
app.decorate("requireVerified", requireVerified);

// Health check
app.get("/health", async () => {
  return { status: "ok", timestamp: new Date().toISOString() };
});

// Route registration
await app.register(authRoutes, { prefix: "/auth" });
await app.register(verificationRoutes, { prefix: "/verification" });
await app.register(profileRoutes, { prefix: "/profile" });
await app.register(discoveryRoutes, { prefix: "/discovery" });
await app.register(matchesRoutes, { prefix: "/matches" });
await app.register(conversationsRoutes, { prefix: "/conversations" });
await app.register(usersRoutes, { prefix: "/users" });

// WebSocket setup
await setupWebSocket(app);

const start = async () => {
  try {
    await app.listen({
      port: config.port,
      host: config.host,
    });
    console.log(`Server running at http://${config.host}:${config.port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
