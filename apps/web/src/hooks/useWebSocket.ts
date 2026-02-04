"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { getToken } from "@/lib/auth";

interface WsMessage {
  type: string;
  payload?: unknown;
}

type MessageHandler = (message: WsMessage) => void;

interface UseWebSocketOptions {
  onMessage?: MessageHandler;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
  autoConnect?: boolean;
}

interface UseWebSocketReturn {
  isConnected: boolean;
  isAuthenticated: boolean;
  connect: () => void;
  disconnect: () => void;
  send: (message: WsMessage) => void;
  joinRoom: (room: string) => void;
  leaveRoom: (room: string) => void;
}

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3001/ws";

export function useWebSocket(options: UseWebSocketOptions = {}): UseWebSocketReturn {
  const {
    onMessage,
    onConnect,
    onDisconnect,
    onError,
    autoConnect = true,
  } = options;

  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const joinedRooms = useRef<Set<string>>(new Set());

  const clearReconnectTimeout = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const scheduleReconnect = useCallback(() => {
    if (reconnectAttempts.current >= maxReconnectAttempts) {
      console.log("Max reconnect attempts reached");
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
    reconnectAttempts.current++;

    reconnectTimeoutRef.current = setTimeout(() => {
      console.log(`Reconnecting... attempt ${reconnectAttempts.current}`);
      connect();
    }, delay);
  }, []);

  const connect = useCallback(() => {
    const token = getToken();
    if (!token) {
      console.log("No token available for WebSocket connection");
      return;
    }

    // Close existing connection
    if (wsRef.current) {
      wsRef.current.close();
    }

    clearReconnectTimeout();

    try {
      const ws = new WebSocket(`${WS_URL}?token=${token}`);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("WebSocket connected");
        setIsConnected(true);
        reconnectAttempts.current = 0;
        onConnect?.();
      };

      ws.onmessage = (event) => {
        try {
          const message: WsMessage = JSON.parse(event.data);

          // Handle authentication response
          if (message.type === "authenticated") {
            setIsAuthenticated(true);
            // Rejoin any rooms we were in
            for (const room of joinedRooms.current) {
              ws.send(JSON.stringify({ type: "join", payload: { room } }));
            }
          }

          // Handle room events
          if (message.type === "room:joined") {
            const payload = message.payload as { room: string };
            joinedRooms.current.add(payload.room);
          }

          if (message.type === "room:left") {
            const payload = message.payload as { room: string };
            joinedRooms.current.delete(payload.room);
          }

          onMessage?.(message);
        } catch (err) {
          console.error("Failed to parse WebSocket message:", err);
        }
      };

      ws.onclose = (event) => {
        console.log("WebSocket disconnected", event.code, event.reason);
        setIsConnected(false);
        setIsAuthenticated(false);
        wsRef.current = null;
        onDisconnect?.();

        // Reconnect on abnormal close
        if (event.code !== 1000 && event.code !== 4001 && event.code !== 4002) {
          scheduleReconnect();
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        onError?.(error);
      };
    } catch (err) {
      console.error("Failed to create WebSocket:", err);
      scheduleReconnect();
    }
  }, [onConnect, onDisconnect, onError, onMessage, clearReconnectTimeout, scheduleReconnect]);

  const disconnect = useCallback(() => {
    clearReconnectTimeout();
    reconnectAttempts.current = maxReconnectAttempts; // Prevent reconnection
    
    if (wsRef.current) {
      wsRef.current.close(1000, "User disconnected");
      wsRef.current = null;
    }
    
    setIsConnected(false);
    setIsAuthenticated(false);
    joinedRooms.current.clear();
  }, [clearReconnectTimeout]);

  const send = useCallback((message: WsMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn("WebSocket not connected, cannot send message");
    }
  }, []);

  const joinRoom = useCallback((room: string) => {
    joinedRooms.current.add(room); // Track for reconnection
    send({ type: "join", payload: { room } });
  }, [send]);

  const leaveRoom = useCallback((room: string) => {
    joinedRooms.current.delete(room);
    send({ type: "leave", payload: { room } });
  }, [send]);

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    isConnected,
    isAuthenticated,
    connect,
    disconnect,
    send,
    joinRoom,
    leaveRoom,
  };
}
