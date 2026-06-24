import { io, type Socket } from "socket.io-client";
import { API_ORIGIN } from "@/lib/api/request";
import type { Message, MessageReaction } from "@/lib/types";

export type RealtimeListenEvents = {
  "connection.ready": (payload: { tenantId: string; userId: string }) => void;
  "connection.error": (payload: { message: string }) => void;
  "presence.snapshot": (payload: { onlineUserIds: string[]; tenantId: string }) => void;
  "presence.online": (payload: { tenantId: string; userId: string }) => void;
  "presence.offline": (payload: { tenantId: string; userId: string }) => void;
  "message.created": (message: Message) => void;
  "message.updated": (message: Message) => void;
  "message.deleted": (payload: { conversationId: string; messageId: string }) => void;
  "message.reaction.updated": (payload: {
    conversationId: string;
    emoji?: string;
    messageId: string;
    reaction?: MessageReaction;
    removed?: boolean;
    userId?: string;
  }) => void;
  "typing.started": (payload: { conversationId: string; userId: string }) => void;
  "typing.stopped": (payload: { conversationId: string; userId: string }) => void;
};

export type RealtimeEmitEvents = {
  "conversation.join": (payload: { conversationId: string }) => void;
  "conversation.leave": (payload: { conversationId: string }) => void;
  "typing.start": (payload: { conversationId: string }) => void;
  "typing.stop": (payload: { conversationId: string }) => void;
};

export type RealtimeSocket = Socket<RealtimeListenEvents, RealtimeEmitEvents>;

export function createRealtimeSocket(token: string) {
  return io(`${API_ORIGIN}/realtime`, {
    auth: {
      method: "bearer",
      token,
    },
    autoConnect: false,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 700,
    reconnectionDelayMax: 5000,
    transports: ["websocket"],
  }) as RealtimeSocket;
}
