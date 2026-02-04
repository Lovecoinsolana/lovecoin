import { FastifyInstance, FastifyRequest } from "fastify";
import type { WebSocket } from "@fastify/websocket";
import { JwtPayload } from "./jwt.js";
import { prisma } from "./prisma.js";

interface AuthenticatedSocket extends WebSocket {
  userId?: string;
  walletAddress?: string;
  rooms: Set<string>;
}

interface WsMessage {
  type: string;
  payload?: unknown;
}

// Store all connected clients
const clients = new Map<string, Set<AuthenticatedSocket>>();

// Store room subscriptions
const rooms = new Map<string, Set<AuthenticatedSocket>>();

export function getRoom(roomName: string): Set<AuthenticatedSocket> {
  if (!rooms.has(roomName)) {
    rooms.set(roomName, new Set());
  }
  return rooms.get(roomName)!;
}

export function broadcastToRoom(roomName: string, message: WsMessage, excludeSocket?: AuthenticatedSocket) {
  const room = rooms.get(roomName);
  if (!room) return;

  const messageStr = JSON.stringify(message);
  
  for (const socket of room) {
    if (socket !== excludeSocket && socket.readyState === 1) { // WebSocket.OPEN = 1
      socket.send(messageStr);
    }
  }
}

export function broadcastNewMessage(conversationId: string, message: {
  id: string;
  content: string;
  contentType: string;
  senderId: string;
  paymentTx: string;
  sentAt: Date;
}) {
  const roomName = `conversation:${conversationId}`;
  
  broadcastToRoom(roomName, {
    type: "message:new",
    payload: {
      conversationId,
      message: {
        id: message.id,
        content: message.content,
        contentType: message.contentType,
        senderId: message.senderId,
        paymentTx: message.paymentTx,
        sentAt: message.sentAt,
      },
    },
  });
}

async function handleJoin(socket: AuthenticatedSocket, roomName: string, app: FastifyInstance) {
  if (!socket.userId) {
    socket.send(JSON.stringify({ type: "error", payload: { message: "Not authenticated" } }));
    return;
  }

  // Validate room name format
  if (!roomName.startsWith("conversation:")) {
    socket.send(JSON.stringify({ type: "error", payload: { message: "Invalid room name" } }));
    return;
  }

  const conversationId = roomName.replace("conversation:", "");

  // Check if user has access to this conversation
  const conversation = await prisma.conversation.findFirst({
    where: {
      id: conversationId,
      match: {
        isActive: true,
        OR: [
          { userAId: socket.userId },
          { userBId: socket.userId },
        ],
      },
    },
  });

  if (!conversation) {
    socket.send(JSON.stringify({ type: "error", payload: { message: "Access denied to conversation" } }));
    return;
  }

  // Join the room
  const room = getRoom(roomName);
  room.add(socket);
  socket.rooms.add(roomName);

  socket.send(JSON.stringify({
    type: "room:joined",
    payload: { room: roomName },
  }));
}

function handleLeave(socket: AuthenticatedSocket, roomName: string) {
  const room = rooms.get(roomName);
  if (room) {
    room.delete(socket);
    if (room.size === 0) {
      rooms.delete(roomName);
    }
  }
  socket.rooms.delete(roomName);

  socket.send(JSON.stringify({
    type: "room:left",
    payload: { room: roomName },
  }));
}

function handleDisconnect(socket: AuthenticatedSocket) {
  // Remove from all rooms
  for (const roomName of socket.rooms) {
    const room = rooms.get(roomName);
    if (room) {
      room.delete(socket);
      if (room.size === 0) {
        rooms.delete(roomName);
      }
    }
  }

  // Remove from clients map
  if (socket.userId) {
    const userSockets = clients.get(socket.userId);
    if (userSockets) {
      userSockets.delete(socket);
      if (userSockets.size === 0) {
        clients.delete(socket.userId);
      }
    }
  }
}

export async function setupWebSocket(app: FastifyInstance) {
  app.get("/ws", { websocket: true }, (socket, request: FastifyRequest) => {
    const authSocket = socket as AuthenticatedSocket;
    authSocket.rooms = new Set();

    // Get token from query string
    const url = new URL(request.url, `http://${request.headers.host}`);
    const token = url.searchParams.get("token");

    if (!token) {
      socket.send(JSON.stringify({ type: "error", payload: { message: "Missing token" } }));
      socket.close(4001, "Missing token");
      return;
    }

    // Verify JWT
    try {
      const decoded = app.jwt.verify<JwtPayload>(token);
      authSocket.userId = decoded.userId;
      authSocket.walletAddress = decoded.walletAddress;

      // Add to clients map
      if (!clients.has(decoded.userId)) {
        clients.set(decoded.userId, new Set());
      }
      clients.get(decoded.userId)!.add(authSocket);

      socket.send(JSON.stringify({
        type: "authenticated",
        payload: { userId: decoded.userId },
      }));
    } catch (err) {
      socket.send(JSON.stringify({ type: "error", payload: { message: "Invalid token" } }));
      socket.close(4002, "Invalid token");
      return;
    }

    // Handle messages
    socket.on("message", async (data: Buffer) => {
      try {
        const message: WsMessage = JSON.parse(data.toString());

        switch (message.type) {
          case "join":
            if (typeof message.payload === "object" && message.payload && "room" in message.payload) {
              await handleJoin(authSocket, (message.payload as { room: string }).room, app);
            }
            break;

          case "leave":
            if (typeof message.payload === "object" && message.payload && "room" in message.payload) {
              handleLeave(authSocket, (message.payload as { room: string }).room);
            }
            break;

          case "ping":
            socket.send(JSON.stringify({ type: "pong" }));
            break;

          default:
            socket.send(JSON.stringify({ type: "error", payload: { message: "Unknown message type" } }));
        }
      } catch (err) {
        socket.send(JSON.stringify({ type: "error", payload: { message: "Invalid message format" } }));
      }
    });

    // Handle close
    socket.on("close", () => {
      handleDisconnect(authSocket);
    });

    // Handle errors
    socket.on("error", (err) => {
      console.error("WebSocket error:", err);
      handleDisconnect(authSocket);
    });
  });
}
