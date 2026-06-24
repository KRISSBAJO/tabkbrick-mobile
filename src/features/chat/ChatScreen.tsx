import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as DocumentPicker from "expo-document-picker";
import EmojiPicker, { type EmojiType } from "rn-emoji-keyboard";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  ArrowLeft,
  Check,
  Edit3,
  FileText,
  MessageCircle,
  Paperclip,
  Pin,
  Plus,
  Search,
  Send,
  Smile,
  Trash2,
  UserPlus,
  Users,
  Wifi,
  WifiOff,
  X,
} from "lucide-react-native";
import {
  addMessageReaction,
  createConversation,
  createFileAsset,
  createUploadIntent,
  deleteMessage,
  listConversations,
  listMessages,
  listPinnedMessages,
  listUsers,
  pinMessage,
  removeMessageReaction,
  sendMessage,
  unpinMessage,
  updateMessage,
  type CreateMessagePayload,
} from "@/lib/api";
import { useAuthSession } from "@/lib/auth/AuthSessionProvider";
import { createRealtimeSocket, type RealtimeSocket } from "@/lib/realtime/realtimeClient";
import { fontFamilyForWeight, withFontStyles } from "@/lib/theme/fontDefaults";
import { colors, radii, shadow } from "@/lib/theme/tokens";
import type { Conversation, Message, TenantUser, UploadIntent, UserSummary } from "@/lib/types";

const reactionOptions = ["\u{1F44D}", "\u2764\uFE0F", "\u{1F602}", "\u{1F525}", "\u{1F62E}", "\u{1F389}", "\u2705", "\u{1F440}"] as const;

const emojiKeyboardTheme = {
  backdrop: "rgba(16,16,15,0.42)",
  container: colors.panel,
  header: colors.foreground,
  knob: colors.line,
  skinTonesContainer: colors.panel,
  category: {
    container: colors.panelMuted,
    containerActive: colors.blueSoft,
    icon: colors.inkSoft,
    iconActive: colors.accent,
  },
  search: {
    background: colors.panelMuted,
    icon: colors.inkSoft,
    placeholder: "#9e9690",
    text: colors.foreground,
  },
  customButton: {
    background: colors.primary,
    backgroundPressed: colors.primaryDark,
    icon: colors.black,
    iconPressed: colors.black,
  },
  emoji: {
    selected: colors.yellowSoft,
  },
};

const emojiKeyboardStyles = {
  container: {
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    paddingTop: 8,
  },
  header: {
    fontFamily: fontFamilyForWeight("900"),
    fontSize: 15,
    fontWeight: "900" as const,
  },
  knob: {
    backgroundColor: colors.line,
    width: 44,
  },
  searchBar: {
    container: {
      borderRadius: 18,
      minHeight: 46,
    },
    text: {
      fontFamily: fontFamilyForWeight("800"),
      fontSize: 15,
      fontWeight: "800" as const,
    },
  },
};

type ChatAttachment = {
  kind: "image" | "video" | "audio" | "file" | "link";
  mimeType?: string | null;
  name: string;
  sizeBytes?: number | null;
  url: string;
};

type PickedAsset = {
  mimeType?: string | null;
  name: string;
  size?: number | null;
  uri: string;
};

type EmojiTarget = { type: "composer" } | { message: Message; type: "reaction" };

export function ChatScreen() {
  const { accessToken, user } = useAuthSession();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);
  const [search, setSearch] = useState("");
  const [messageDraft, setMessageDraft] = useState("");
  const [emojiTarget, setEmojiTarget] = useState<EmojiTarget | null>(null);
  const [pendingAttachments, setPendingAttachments] = useState<ChatAttachment[]>([]);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(() => new Set());
  const [typingUserIds, setTypingUserIds] = useState<Set<string>>(() => new Set());
  const listRef = useRef<FlatList<Message>>(null);
  const socketRef = useRef<RealtimeSocket | null>(null);
  const messageDraftRef = useRef("");
  const joinedConversationIdsRef = useRef<Set<string>>(new Set());
  const activeConversationIdRef = useRef<string | null>(null);
  const typingActiveRef = useRef(false);
  const typingStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeTitle = useMemo(
    () => activeConversation ? conversationTitle(activeConversation, user?.id) : "Chat",
    [activeConversation, user?.id],
  );
  const activeMembers = activeConversation?.members ?? [];
  const activeTypingNames = useMemo(
    () => activeMembers
      .filter((m) => m.userId !== user?.id && typingUserIds.has(m.userId))
      .map((m) => displayUserName(m.user))
      .slice(0, 2),
    [activeMembers, typingUserIds, user?.id],
  );
  const activeOnlineCount = useMemo(
    () => activeMembers.filter((m) => onlineUserIds.has(m.userId)).length,
    [activeMembers, onlineUserIds],
  );
  const conversationPreview = useMemo(
    () => conversations.find((c) => c.id === activeConversation?.id) ?? activeConversation,
    [activeConversation, conversations],
  );

  const filteredConversations = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return conversations;
    return conversations.filter((c) => {
      const title = conversationTitle(c, user?.id).toLowerCase();
      const members = c.members.map((m) => displayUserName(m.user)).join(" ").toLowerCase();
      const latest = latestMessage(c)?.body?.toLowerCase() ?? "";
      return title.includes(term) || members.includes(term) || latest.includes(term);
    });
  }, [conversations, search, user?.id]);

  const upsertMessage = useCallback((message: Message) => {
    setMessages((current) => orderMessages([
      ...current.filter((item) => item.id !== message.id),
      message,
    ]));
    setConversations((current) => mergeMessageIntoConversations(current, message));
    if (message.pinnedAt) {
      setPinnedMessages((current) => orderMessages([
        ...current.filter((item) => item.id !== message.id),
        message,
      ]));
    } else {
      setPinnedMessages((current) => current.filter((item) => item.id !== message.id));
    }
  }, []);

  const removeMessageFromState = useCallback((messageId: string) => {
    setMessages((current) => current.filter((m) => m.id !== messageId));
    setPinnedMessages((current) => current.filter((m) => m.id !== messageId));
  }, []);

  const mergeReactionIntoMessage = useCallback((payload: {
    emoji?: string;
    messageId: string;
    reaction?: NonNullable<Message["reactions"]>[number];
    removed?: boolean;
    userId?: string;
  }) => {
    const apply = (message: Message): Message => {
      if (message.id !== payload.messageId) return message;
      const reactions = message.reactions ?? [];
      if (payload.removed) {
        return {
          ...message,
          reactions: reactions.filter((r) => !(r.userId === payload.userId && r.emoji === payload.emoji)),
        };
      }
      if (!payload.reaction) return message;
      return {
        ...message,
        reactions: [
          ...reactions.filter((r) => r.id !== payload.reaction?.id),
          payload.reaction,
        ],
      };
    };
    setMessages((current) => current.map(apply));
    setPinnedMessages((current) => current.map(apply));
  }, []);

  const stopTyping = useCallback(() => {
    if (!activeConversationIdRef.current || !typingActiveRef.current) return;
    typingActiveRef.current = false;
    socketRef.current?.emit("typing.stop", { conversationId: activeConversationIdRef.current });
  }, []);

  const leaveConversationRoom = useCallback((conversationId: string | null | undefined) => {
    if (!conversationId) return;
    if (socketRef.current?.connected && joinedConversationIdsRef.current.has(conversationId)) {
      socketRef.current.emit("conversation.leave", { conversationId });
    }
    joinedConversationIdsRef.current.delete(conversationId);
  }, []);

  const handleDraftChange = useCallback((value: string) => {
    messageDraftRef.current = value;
    setMessageDraft(value);
    const conversationId = activeConversationIdRef.current;
    if (!conversationId || !socketRef.current?.connected) return;
    if (!typingActiveRef.current) {
      typingActiveRef.current = true;
      socketRef.current.emit("typing.start", { conversationId });
    }
    if (typingStopTimerRef.current) clearTimeout(typingStopTimerRef.current);
    typingStopTimerRef.current = setTimeout(stopTyping, 1200);
  }, [stopTyping]);

  const loadConversations = useCallback(async (options: { silent?: boolean } = {}) => {
    if (!accessToken) return;
    if (!options.silent) setLoadingConversations(true);
    setError(null);
    try {
      const page = await listConversations(accessToken, { limit: 80, page: 1 });
      setConversations(page.data);
      if (activeConversationIdRef.current) {
        const next = page.data.find((c) => c.id === activeConversationIdRef.current);
        if (next) setActiveConversation(next);
      }
    } catch (caught) {
      setError(errorMessage(caught, "Unable to load conversations."));
    } finally {
      if (!options.silent) setLoadingConversations(false);
    }
  }, [accessToken]);

  const loadConversationMessages = useCallback(async (conversation: Conversation, options: { silent?: boolean } = {}) => {
    if (!accessToken) return;
    if (!options.silent) setLoadingMessages(true);
    setError(null);
    try {
      const [messagePage, pinned] = await Promise.all([
        listMessages(accessToken, conversation.id, { limit: 100, page: 1 }),
        listPinnedMessages(accessToken, conversation.id),
      ]);
      setMessages(orderMessages(messagePage.data));
      setPinnedMessages(orderMessages(pinned));
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: false }));
    } catch (caught) {
      setError(errorMessage(caught, "Unable to load messages."));
    } finally {
      if (!options.silent) setLoadingMessages(false);
    }
  }, [accessToken]);

  const openConversation = useCallback((conversation: Conversation) => {
    const previousId = activeConversationIdRef.current;
    if (previousId && previousId !== conversation.id) {
      stopTyping();
      leaveConversationRoom(previousId);
    }
    setActiveConversation(conversation);
    setSelectedMessage(null);
    setEditingMessage(null);
    messageDraftRef.current = "";
    setMessageDraft("");
    setEmojiTarget(null);
    void loadConversationMessages(conversation);
  }, [leaveConversationRoom, loadConversationMessages, stopTyping]);

  useEffect(() => {
    const timer = setTimeout(() => void loadConversations(), 0);
    return () => clearTimeout(timer);
  }, [loadConversations]);

  useEffect(() => {
    activeConversationIdRef.current = activeConversation?.id ?? null;
  }, [activeConversation?.id]);

  useEffect(() => {
    messageDraftRef.current = messageDraft;
  }, [messageDraft]);

  useEffect(() => {
    if (!accessToken) return undefined;
    const socket = createRealtimeSocket(accessToken);
    socketRef.current = socket;
    joinedConversationIdsRef.current = new Set();

    socket.on("connect", () => {
      setSocketConnected(true);
      joinedConversationIdsRef.current = new Set();
      const conversationId = activeConversationIdRef.current;
      if (conversationId) {
        socket.emit("conversation.join", { conversationId });
        joinedConversationIdsRef.current.add(conversationId);
      }
    });
    socket.on("disconnect", () => {
      setSocketConnected(false);
      typingActiveRef.current = false;
      joinedConversationIdsRef.current = new Set();
    });
    socket.on("connection.error", (payload) => setError(normalizeErrorText(payload.message, "Realtime connection interrupted.")));
    socket.on("presence.snapshot", (payload) => setOnlineUserIds(new Set(payload.onlineUserIds)));
    socket.on("presence.online", (payload) => {
      setOnlineUserIds((current) => new Set([...current, payload.userId]));
    });
    socket.on("presence.offline", (payload) => {
      setOnlineUserIds((current) => {
        const next = new Set(current);
        next.delete(payload.userId);
        return next;
      });
    });
    socket.on("typing.started", (payload) => {
      if (payload.userId === user?.id || payload.conversationId !== activeConversationIdRef.current) return;
      setTypingUserIds((current) => new Set([...current, payload.userId]));
    });
    socket.on("typing.stopped", (payload) => {
      setTypingUserIds((current) => {
        const next = new Set(current);
        next.delete(payload.userId);
        return next;
      });
    });
    socket.on("message.created", (message) => {
      if (message.conversationId === activeConversationIdRef.current) {
        upsertMessage(message);
        requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
      } else {
        setConversations((current) => mergeMessageIntoConversations(current, message));
      }
    });
    socket.on("message.updated", (message) => {
      if (message.conversationId === activeConversationIdRef.current) upsertMessage(message);
      setConversations((current) => mergeMessageIntoConversations(current, message));
    });
    socket.on("message.deleted", (payload) => {
      removeMessageFromState(payload.messageId);
      setConversations((current) => current.map((c) => (
        c.id === payload.conversationId
          ? { ...c, messages: (c.messages ?? []).filter((m) => m.id !== payload.messageId) }
          : c
      )));
    });
    socket.on("message.reaction.updated", mergeReactionIntoMessage);
    socket.connect();

    return () => {
      if (typingStopTimerRef.current) clearTimeout(typingStopTimerRef.current);
      typingActiveRef.current = false;
      socket.disconnect();
      socketRef.current = null;
      setSocketConnected(false);
    };
  }, [accessToken, mergeReactionIntoMessage, removeMessageFromState, upsertMessage, user?.id]);

  useEffect(() => {
    const socket = socketRef.current;
    const conversationId = activeConversation?.id;
    if (!socket?.connected || !conversationId || joinedConversationIdsRef.current.has(conversationId)) return;
    socket.emit("conversation.join", { conversationId });
    joinedConversationIdsRef.current.add(conversationId);
  }, [activeConversation?.id]);

  useEffect(() => {
    if (!error) return undefined;
    const timer = setTimeout(() => setError(null), 6000);
    return () => clearTimeout(timer);
  }, [error]);

  async function refresh() {
    if (!accessToken) return;
    setRefreshing(true);
    try {
      await loadConversations({ silent: true });
      if (activeConversation) {
        await loadConversationMessages(activeConversation, { silent: true });
      }
    } finally {
      setRefreshing(false);
    }
  }

  async function handleSend() {
    if (!accessToken || !activeConversation) return;
    const body = messageDraft.trim();
    if (editingMessage && !body) return;
    if (!editingMessage && !body && pendingAttachments.length === 0) return;

    const prevDraft = messageDraft;
    const prevAttachments = pendingAttachments;
    messageDraftRef.current = "";
    setMessageDraft("");
    setPendingAttachments([]);
    setEmojiTarget(null);
    stopTyping();

    try {
      if (editingMessage) {
        const updated = await updateMessage(accessToken, editingMessage.id, { body });
        upsertMessage(updated);
        setEditingMessage(null);
      } else {
        const payload: CreateMessagePayload = {
          body: body || undefined,
          attachments: pendingAttachments.length ? pendingAttachments as unknown as CreateMessagePayload["attachments"] : undefined,
        };
        const created = await sendMessage(accessToken, activeConversation.id, payload);
        upsertMessage(created);
      }
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    } catch (caught) {
      messageDraftRef.current = prevDraft;
      setMessageDraft(prevDraft);
      setPendingAttachments(prevAttachments);
      setError(errorMessage(caught, "Message could not be sent."));
    }
  }

  async function handleReaction(message: Message, emoji: string) {
    if (!accessToken || !user) return;
    const mine = message.reactions?.some((r) => r.userId === user.id && r.emoji === emoji);
    try {
      if (mine) {
        await removeMessageReaction(accessToken, message.id, emoji);
        mergeReactionIntoMessage({ emoji, messageId: message.id, removed: true, userId: user.id });
      } else {
        const reaction = await addMessageReaction(accessToken, message.id, emoji);
        mergeReactionIntoMessage({ messageId: message.id, reaction });
      }
    } catch (caught) {
      setError(errorMessage(caught, "Reaction was not saved."));
    }
  }

  function openComposerEmojiPicker() {
    setEmojiTarget({ type: "composer" });
  }

  function openReactionEmojiPicker(message: Message) {
    setSelectedMessage(null);
    setEmojiTarget({ message, type: "reaction" });
  }

  function closeEmojiPicker() {
    setEmojiTarget(null);
  }

  function handleEmojiSelected(emoji: EmojiType) {
    const symbol = emoji.emoji;
    if (!symbol) return;

    if (emojiTarget?.type === "reaction") {
      void handleReaction(emojiTarget.message, symbol);
      setEmojiTarget(null);
      return;
    }

    handleDraftChange(`${messageDraftRef.current}${symbol}`);
  }

  async function handlePickAttachment() {
    if (!accessToken || !activeConversation || uploadingAttachment) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: true, type: "*/*" });
      if (result.canceled) return;
      setUploadingAttachment(true);
      const uploaded: ChatAttachment[] = [];
      for (const asset of result.assets.slice(0, 5)) {
        uploaded.push(await uploadPickedAsset(accessToken, activeConversation.id, {
          mimeType: asset.mimeType,
          name: asset.name,
          size: asset.size,
          uri: asset.uri,
        }));
      }
      setPendingAttachments((current) => [...current, ...uploaded].slice(0, 8));
    } catch (caught) {
      setError(errorMessage(caught, "Attachment could not be prepared."));
    } finally {
      setUploadingAttachment(false);
    }
  }

  function removePendingAttachment(index: number) {
    setPendingAttachments((current) => current.filter((_, i) => i !== index));
  }

  async function togglePin(message: Message) {
    if (!accessToken || !activeConversation) return;
    try {
      const updated = message.pinnedAt
        ? await unpinMessage(accessToken, message.id)
        : await pinMessage(accessToken, message.id);
      setSelectedMessage(null);
      upsertMessage(updated);
    } catch (caught) {
      setError(errorMessage(caught, "Pin state was not saved."));
    }
  }

  function beginEdit(message: Message) {
    setEditingMessage(message);
    messageDraftRef.current = message.body ?? "";
    setMessageDraft(message.body ?? "");
    setEmojiTarget(null);
    setSelectedMessage(null);
  }

  function confirmDeleteMessage(message: Message) {
    if (!accessToken || !activeConversation) return;
    Alert.alert("Delete message", "Remove this message from the conversation?", [
      { style: "cancel", text: "Cancel" },
      {
        style: "destructive",
        text: "Delete",
        onPress: () => {
          void deleteMessage(accessToken, message.id)
            .then(() => {
              setSelectedMessage(null);
              setMessages((current) => current.filter((item) => item.id !== message.id));
            })
            .catch((caught: unknown) => setError(errorMessage(caught, "Message was not deleted.")));
        },
      },
    ]);
  }

  function closeConversation() {
    stopTyping();
    leaveConversationRoom(activeConversationIdRef.current);
    setActiveConversation(null);
    setMessages([]);
    setPinnedMessages([]);
    setPendingAttachments([]);
    setSelectedMessage(null);
    setEditingMessage(null);
    messageDraftRef.current = "";
    setMessageDraft("");
    setEmojiTarget(null);
  }

  const canSend = messageDraft.trim().length > 0 || pendingAttachments.length > 0;

  if (!user) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.screenBody}>
          <View style={styles.emptyState}>
            <View style={styles.emptyIconRing}>
              <MessageCircle color={colors.accent} size={34} strokeWidth={2.5} />
            </View>
            <Text style={styles.emptyTitle}>Sign in required</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.keyboard}>

        {/* â”€â”€â”€ HEADER â”€â”€â”€ */}
        <View style={styles.header}>
          {activeConversation ? (
            <Pressable accessibilityRole="button" onPress={closeConversation} style={styles.headerBtn}>
              <ArrowLeft color={colors.white} size={21} strokeWidth={2.8} />
            </Pressable>
          ) : (
            <View style={styles.headerMark}>
              <MessageCircle color={colors.primary} size={22} strokeWidth={2.7} />
            </View>
          )}

          <View style={styles.headerCopy}>
            <View style={styles.headerMetaRow}>
              <View style={[styles.connectionDot, socketConnected ? styles.connectionDotOn : styles.connectionDotOff]} />
              {socketConnected
                ? <Wifi color="rgba(255,255,255,0.5)" size={11} strokeWidth={3} />
                : <WifiOff color="rgba(255,255,255,0.38)" size={11} strokeWidth={3} />}
              <Text style={styles.eyebrow}>
                {activeConversation
                  ? `${activeMembers.length} members - ${activeOnlineCount} online`
                  : socketConnected ? "Connected" : "Reconnecting..."}
              </Text>
            </View>
            <Text numberOfLines={1} style={styles.headerTitle}>
              {activeConversation ? activeTitle : "Team chat"}
            </Text>
          </View>

          {activeConversation ? (
            <View style={styles.threadAvatarWrap}>
              <View style={styles.headerAvatarScale}>
                <ConversationAvatar conversation={conversationPreview} currentUserId={user.id} />
              </View>
              {activeOnlineCount > 0 && <View style={styles.onlineDotHeader} />}
            </View>
          ) : (
            <Pressable accessibilityRole="button" onPress={() => setNewChatOpen(true)} style={styles.newBtn}>
              <Plus color={colors.black} size={24} strokeWidth={3} />
            </Pressable>
          )}
        </View>

        {/* â”€â”€â”€ ERROR BANNER â”€â”€â”€ */}
        {error ? (
          <Pressable accessibilityRole="button" onPress={() => setError(null)} style={styles.errorBanner}>
            <Text numberOfLines={2} style={styles.errorText}>{error}</Text>
            <X color={colors.danger} size={16} strokeWidth={2.5} />
          </Pressable>
        ) : null}

        {/* â”€â”€â”€ THREAD / INBOX â”€â”€â”€ */}
        {activeConversation ? (
          <View style={styles.thread}>

            {/* Pinned strip */}
            {pinnedMessages.length > 0 && (
              <View style={styles.pinnedStrip}>
                <Pin color={colors.primaryDark} size={12} strokeWidth={2.8} />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pinnedScroll}>
                  {pinnedMessages.slice(0, 8).map((msg) => (
                    <Pressable accessibilityRole="button" key={msg.id} onPress={() => setSelectedMessage(msg)} style={styles.pinnedChip}>
                      <Text numberOfLines={1} style={styles.pinnedChipText}>{msg.body || "Pinned attachment"}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Messages */}
            {loadingMessages ? (
              <View style={styles.loadingState}>
                <ActivityIndicator color={colors.accent} size="large" />
              </View>
            ) : (
              <FlatList
                contentContainerStyle={styles.messageList}
                data={messages}
                keyExtractor={(item) => item.id}
                ref={listRef}
                refreshControl={<RefreshControl refreshing={refreshing} tintColor={colors.accent} onRefresh={() => void refresh()} />}
                renderItem={({ item, index }) => (
                  <MessageBubble
                    currentUserId={user.id}
                    message={item}
                    previous={messages[index - 1]}
                    showDateDivider={index === 0 || !sameDay(messages[index - 1]?.createdAt ?? "", item.createdAt)}
                    onPress={() => setSelectedMessage(item)}
                  />
                )}
                ListEmptyComponent={<EmptyThread />}
                onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
              />
            )}

            {/* Editing bar */}
            {editingMessage ? (
              <View style={styles.editingBar}>
                <Edit3 color={colors.accent} size={15} strokeWidth={2.6} />
                <Text numberOfLines={1} style={styles.editingText}>Editing message</Text>
                <Pressable accessibilityRole="button" onPress={() => { setEditingMessage(null); messageDraftRef.current = ""; setMessageDraft(""); setEmojiTarget(null); }}>
                  <X color={colors.inkSoft} size={17} strokeWidth={2.7} />
                </Pressable>
              </View>
            ) : null}

            {/* Typing indicator */}
            {activeTypingNames.length > 0 && <TypingBubble names={activeTypingNames} />}

            {/* Pending attachments */}
            {pendingAttachments.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pendingList}>
                {pendingAttachments.map((attachment, index) => (
                  <PendingAttachmentCard
                    attachment={attachment}
                    key={`${attachment.url}-${index}`}
                    onRemove={() => removePendingAttachment(index)}
                  />
                ))}
              </ScrollView>
            )}

            {/* Composer */}
            <View style={styles.composer}>
              <Pressable
                accessibilityRole="button"
                disabled={uploadingAttachment}
                onPress={() => void handlePickAttachment()}
                style={[styles.composerIconBtn, uploadingAttachment ? styles.composerIconBtnDim : null]}
              >
                {uploadingAttachment
                  ? <ActivityIndicator color={colors.accent} size="small" />
                  : <Paperclip color={colors.accent} size={20} strokeWidth={2.7} />}
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open emoji picker"
                onPress={openComposerEmojiPicker}
                style={[styles.composerIconBtn, emojiTarget?.type === "composer" ? styles.composerIconBtnActive : null]}
              >
                <Smile color={emojiTarget?.type === "composer" ? colors.black : colors.accent} size={20} strokeWidth={2.7} />
              </Pressable>

              <TextInput
                multiline
                onChangeText={handleDraftChange}
                placeholder="Message your team..."
                placeholderTextColor="#9e9690"
                style={styles.composerInput}
                value={messageDraft}
              />

              <Pressable
                accessibilityRole="button"
                disabled={!canSend}
                onPress={() => void handleSend()}
                style={[styles.sendBtn, canSend ? styles.sendBtnActive : styles.sendBtnIdle]}
              >
                <Send color={canSend ? colors.black : colors.inkSoft} size={19} strokeWidth={2.8} />
              </Pressable>
            </View>
          </View>

        ) : (
          <View style={styles.inbox}>

            {/* Search bar */}
            <View style={styles.searchBar}>
              <Search color={colors.inkSoft} size={18} strokeWidth={2.5} />
              <TextInput
                onChangeText={setSearch}
                placeholder="Search conversations"
                placeholderTextColor="#9e9690"
                style={styles.searchInput}
                value={search}
              />
              {search ? (
                <Pressable accessibilityRole="button" onPress={() => setSearch("")} style={styles.searchClear}>
                  <X color={colors.inkSoft} size={16} strokeWidth={2.7} />
                </Pressable>
              ) : null}
            </View>

            {/* Section label */}
            {filteredConversations.length > 0 && (
              <View style={styles.sectionLabel}>
                <Text style={styles.sectionLabelText}>
                  {search ? `${filteredConversations.length} result${filteredConversations.length !== 1 ? "s" : ""}` : "Recent"}
                </Text>
              </View>
            )}

            {loadingConversations ? (
              <View style={styles.loadingState}>
                <ActivityIndicator color={colors.accent} size="large" />
              </View>
            ) : (
              <FlatList
                contentContainerStyle={styles.conversationList}
                data={filteredConversations}
                keyExtractor={(item) => item.id}
                refreshControl={<RefreshControl refreshing={refreshing} tintColor={colors.accent} onRefresh={() => void refresh()} />}
                renderItem={({ item }) => (
                  <ConversationRow
                    conversation={item}
                    currentUserId={user.id}
                    isOnline={item.members.some((m) => m.userId !== user.id && onlineUserIds.has(m.userId))}
                    onPress={() => openConversation(item)}
                  />
                )}
                ListEmptyComponent={<EmptyInbox onCreate={() => setNewChatOpen(true)} />}
              />
            )}
          </View>
        )}
      </KeyboardAvoidingView>

      <NewConversationModal
        currentUserId={user.id}
        onClose={() => setNewChatOpen(false)}
        onCreated={(conversation) => {
          setNewChatOpen(false);
          setConversations((current) => [conversation, ...current.filter((c) => c.id !== conversation.id)]);
          openConversation(conversation);
        }}
        token={accessToken}
        visible={newChatOpen}
      />

      <MessageActionsModal
        currentUserId={user.id}
        message={selectedMessage}
        onClose={() => setSelectedMessage(null)}
        onDelete={confirmDeleteMessage}
        onEdit={beginEdit}
        onMoreEmoji={openReactionEmojiPicker}
        onPin={(message) => void togglePin(message)}
        onReact={(message, emoji) => void handleReaction(message, emoji)}
      />

      <EmojiPicker
        allowMultipleSelections={emojiTarget?.type === "composer"}
        categoryPosition="bottom"
        defaultHeight={Platform.OS === "ios" ? "46%" : "52%"}
        enableRecentlyUsed
        enableSearchBar
        expandable
        onClose={closeEmojiPicker}
        onEmojiSelected={handleEmojiSelected}
        open={emojiTarget !== null}
        styles={emojiKeyboardStyles}
        theme={emojiKeyboardTheme}
      />
    </SafeAreaView>
  );
}

// â”€â”€â”€ CONVERSATION ROW â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function ConversationRow({
  conversation,
  currentUserId,
  isOnline,
  onPress,
}: {
  conversation: Conversation;
  currentUserId: string;
  isOnline: boolean;
  onPress: () => void;
}) {
  const latest = latestMessage(conversation);
  const title = conversationTitle(conversation, currentUserId);

  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.conversationRow}>
      <View style={styles.avatarWrap}>
        <ConversationAvatar conversation={conversation} currentUserId={currentUserId} />
        {isOnline && <View style={styles.onlineDot} />}
      </View>

      <View style={styles.conversationBody}>
        <View style={styles.rowTop}>
          <Text numberOfLines={1} style={styles.conversationTitle}>{title}</Text>
          {latest && (
            <Text style={styles.conversationTime}>{formatShortTime(latest.createdAt)}</Text>
          )}
        </View>
        <Text numberOfLines={1} style={styles.conversationPreview}>
          {latest?.body || conversationSubtitle(conversation, currentUserId)}
        </Text>
      </View>
    </Pressable>
  );
}

// â”€â”€â”€ CONVERSATION AVATAR â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function ConversationAvatar({
  conversation,
  currentUserId,
}: {
  conversation: Conversation | null | undefined;
  currentUserId: string;
}) {
  const other = conversation?.members.find((m) => m.userId !== currentUserId)?.user ?? conversation?.members[0]?.user;
  const title = conversation ? conversationTitle(conversation, currentUserId) : "Chat";
  const avatarUrl = other?.avatarUrl?.trim();

  if (avatarUrl) {
    return <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />;
  }

  if (conversation?.isGroup) {
    return (
      <View style={[styles.avatarFallback, styles.groupAvatar]}>
        <Users color={colors.accent} size={19} strokeWidth={2.8} />
      </View>
    );
  }

  const bg = initialsColor(title);
  return (
    <View style={[styles.avatarFallback, { backgroundColor: bg }]}>
      <Text style={styles.avatarInitials}>{initials(other, title)}</Text>
    </View>
  );
}

// â”€â”€â”€ DATE DIVIDER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function DateDivider({ date }: { date: string }) {
  return (
    <View style={styles.dateDivider}>
      <View style={styles.dateDividerLine} />
      <View style={styles.dateDividerPill}>
        <Text style={styles.dateDividerText}>{formatMessageDate(date)}</Text>
      </View>
      <View style={styles.dateDividerLine} />
    </View>
  );
}

// â”€â”€â”€ MESSAGE BUBBLE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function MessageBubble({
  currentUserId,
  message,
  previous,
  showDateDivider,
  onPress,
}: {
  currentUserId: string;
  message: Message;
  previous?: Message;
  showDateDivider: boolean;
  onPress: () => void;
}) {
  const mine = message.senderId === currentUserId;
  const startsGroup = !previous || previous.senderId !== message.senderId || !sameDay(previous.createdAt, message.createdAt);
  const reactions = summarizeReactions(message.reactions ?? []);
  const attachments = messageAttachments(message);

  return (
    <View style={styles.messageOuter}>
      {showDateDivider && <DateDivider date={message.createdAt} />}

      <View style={[styles.messageWrap, mine ? styles.messageWrapMine : null]}>
        {startsGroup && (
          <Text style={[styles.senderName, mine ? styles.senderNameMine : null]}>
            {mine ? "You" : displayUserName(message.sender)}
          </Text>
        )}

        <Pressable
          accessibilityRole="button"
          onLongPress={onPress}
          onPress={onPress}
          style={[
            styles.messageBubble,
            attachments.length > 0 ? styles.messageBubbleWide : null,
            mine ? styles.messageBubbleMine : styles.messageBubbleOther,
          ]}
        >
          {message.pinnedAt && (
            <View style={styles.pinnedFlag}>
              <Pin color={mine ? "rgba(16,16,15,0.6)" : colors.primaryDark} size={11} strokeWidth={2.8} />
              <Text style={[styles.pinnedFlagText, mine ? styles.pinnedFlagTextMine : null]}>Pinned</Text>
            </View>
          )}
          {message.body ? (
            <Text style={[styles.messageText, mine ? styles.messageTextMine : null]}>{message.body}</Text>
          ) : null}
          {attachments.map((att, i) => (
            <AttachmentCard attachment={att} key={`${att.url}-${i}`} mine={mine} />
          ))}
          <Text style={[styles.messageTime, mine ? styles.messageTimeMine : null]}>
            {formatShortTime(message.createdAt)}
          </Text>
        </Pressable>

        {reactions.length > 0 && (
          <View style={[styles.reactionRow, mine ? styles.reactionRowMine : null]}>
            {reactions.map((r) => (
              <View key={`${r.emoji}-${r.count}`} style={styles.reactionPill}>
                <Text style={styles.reactionText}>{r.emoji} {r.count}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

// â”€â”€â”€ ATTACHMENT CARD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function AttachmentCard({ attachment, mine }: { attachment: ChatAttachment; mine: boolean }) {
  return (
    <View style={[styles.attachmentCard, mine ? styles.attachmentCardMine : null]}>
      <View style={[styles.attachmentIconBox, mine ? styles.attachmentIconBoxMine : null]}>
        <FileText color={mine ? colors.black : colors.accent} size={18} strokeWidth={2.7} />
      </View>
      <View style={styles.attachmentCopy}>
        <Text numberOfLines={1} style={[styles.attachmentTitle, mine ? styles.attachmentTitleMine : null]}>
          {attachment.name}
        </Text>
        <Text style={[styles.attachmentSub, mine ? styles.attachmentSubMine : null]}>
          {attachmentKindLabel(attachment.kind)} Â· {formatBytes(attachment.sizeBytes)}
        </Text>
      </View>
    </View>
  );
}

// â”€â”€â”€ PENDING ATTACHMENT CARD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function PendingAttachmentCard({ attachment, onRemove }: { attachment: ChatAttachment; onRemove: () => void }) {
  return (
    <View style={styles.pendingCard}>
      <View style={styles.pendingIcon}>
        <FileText color={colors.accent} size={17} strokeWidth={2.7} />
      </View>
      <View style={styles.pendingCopy}>
        <Text numberOfLines={1} style={styles.pendingTitle}>{attachment.name}</Text>
        <Text style={styles.pendingSub}>{attachmentKindLabel(attachment.kind)} Â· {formatBytes(attachment.sizeBytes)}</Text>
      </View>
      <Pressable accessibilityRole="button" onPress={onRemove} style={styles.pendingRemove}>
        <X color={colors.inkSoft} size={14} strokeWidth={2.8} />
      </Pressable>
    </View>
  );
}

// â”€â”€â”€ TYPING BUBBLE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function TypingBubble({ names }: { names: string[] }) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setFrame((f) => (f + 1) % 3), 480);
    return () => clearInterval(timer);
  }, []);

  return (
    <View style={styles.typingRow}>
      <View style={styles.typingBubble}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={[styles.typingDot, frame === i ? styles.typingDotActive : null]} />
        ))}
      </View>
      <Text style={styles.typingLabel}>
        {names.join(", ")} {names.length === 1 ? "is" : "are"} typing
      </Text>
    </View>
  );
}

// â”€â”€â”€ EMPTY STATES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function EmptyInbox({ onCreate }: { onCreate: () => void }) {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconRing}>
        <MessageCircle color={colors.accent} size={34} strokeWidth={2.4} />
      </View>
      <Text style={styles.emptyTitle}>No conversations yet</Text>
      <Text style={styles.emptyText}>Start a direct chat or create a group thread for your project team.</Text>
      <Pressable accessibilityRole="button" onPress={onCreate} style={styles.emptyBtn}>
        <UserPlus color={colors.black} size={18} strokeWidth={2.8} />
        <Text style={styles.emptyBtnText}>Start a chat</Text>
      </Pressable>
    </View>
  );
}

function EmptyThread() {
  return (
    <View style={styles.emptyThread}>
      <View style={styles.emptyIconRing}>
        <MessageCircle color={colors.accent} size={30} strokeWidth={2.4} />
      </View>
      <Text style={styles.emptyTitle}>Be the first to say something</Text>
      <Text style={styles.emptyText}>Send the first message to kick off the conversation.</Text>
    </View>
  );
}

// â”€â”€â”€ NEW CONVERSATION MODAL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function NewConversationModal({
  currentUserId,
  onClose,
  onCreated,
  token,
  visible,
}: {
  currentUserId: string;
  onClose: () => void;
  onCreated: (conversation: Conversation) => void;
  token: string | null;
  visible: boolean;
}) {
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedUsers = users.filter((item) => selectedIds.includes(item.id));
  const isGroup = selectedIds.length > 1;

  const loadTenantUsers = useCallback(async () => {
    if (!token || !visible) return;
    setLoading(true);
    setError(null);
    try {
      const page = await listUsers(token, { limit: 40, page: 1, search: query.trim() || undefined });
      setUsers(page.data.filter((item) => item.id !== currentUserId));
    } catch (caught) {
      setError(errorMessage(caught, "Unable to load users."));
    } finally {
      setLoading(false);
    }
  }, [currentUserId, query, token, visible]);

  useEffect(() => {
    const timer = setTimeout(() => void loadTenantUsers(), 180);
    return () => clearTimeout(timer);
  }, [loadTenantUsers]);

  useEffect(() => {
    if (!visible) {
      setQuery("");
      setSelectedIds([]);
      setTitle("");
      setError(null);
    }
  }, [visible]);

  function toggleUser(userId: string) {
    setSelectedIds((current) =>
      current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId],
    );
  }

  async function submit() {
    if (!token || !selectedIds.length) return;
    setSaving(true);
    setError(null);
    try {
      const conversation = await createConversation(token, {
        isGroup,
        memberIds: selectedIds,
        title: isGroup ? title.trim() || selectedUsers.map((item) => displayUserName(item)).join(", ") : undefined,
      });
      onCreated(conversation);
    } catch (caught) {
      setError(errorMessage(caught, "Conversation was not created."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.modalLayer}>
        <Pressable accessibilityRole="button" onPress={onClose} style={styles.modalScrim} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.sheetEyebrow}>New chat</Text>
              <Text style={styles.sheetTitle}>Choose people</Text>
            </View>
            <Pressable accessibilityRole="button" onPress={onClose} style={styles.sheetClose}>
              <X color={colors.foreground} size={20} strokeWidth={2.8} />
            </Pressable>
          </View>

          <View style={styles.searchBarSheet}>
            <Search color={colors.inkSoft} size={17} strokeWidth={2.5} />
            <TextInput
              onChangeText={setQuery}
              placeholder="Search by name or email"
              placeholderTextColor="#9e9690"
              style={styles.searchInput}
              value={query}
            />
          </View>

          {isGroup && (
            <TextInput
              onChangeText={setTitle}
              placeholder="Group name (optional)"
              placeholderTextColor="#9e9690"
              style={styles.groupNameInput}
              value={title}
            />
          )}

          {selectedUsers.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.selectedList}>
              {selectedUsers.map((item) => (
                <Pressable accessibilityRole="button" key={item.id} onPress={() => toggleUser(item.id)} style={styles.selectedPill}>
                  <Text numberOfLines={1} style={styles.selectedPillText}>{displayUserName(item)}</Text>
                  <X color={colors.black} size={13} strokeWidth={3} />
                </Pressable>
              ))}
            </ScrollView>
          )}

          {error ? <Text style={styles.sheetError}>{error}</Text> : null}

          {loading ? (
            <View style={styles.modalLoading}>
              <ActivityIndicator color={colors.accent} />
            </View>
          ) : (
            <FlatList
              contentContainerStyle={styles.userList}
              data={users}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => {
                const selected = selectedIds.includes(item.id);
                const name = displayUserName(item);
                const bg = initialsColor(name);
                return (
                  <Pressable accessibilityRole="button" onPress={() => toggleUser(item.id)} style={[styles.userRow, selected ? styles.userRowSelected : null]}>
                    <View style={[styles.userAvatar, { backgroundColor: bg }]}>
                      <Text style={styles.userInitials}>{initials(item, name)}</Text>
                    </View>
                    <View style={styles.userBody}>
                      <Text numberOfLines={1} style={styles.userName}>{name}</Text>
                      <Text numberOfLines={1} style={styles.userEmail}>{item.email}</Text>
                    </View>
                    <View style={[styles.checkBox, selected ? styles.checkBoxSelected : null]}>
                      {selected && <Check color={colors.black} size={14} strokeWidth={3} />}
                    </View>
                  </Pressable>
                );
              }}
              ListEmptyComponent={<Text style={styles.emptySmall}>No users found.</Text>}
            />
          )}

          <Pressable
            accessibilityRole="button"
            disabled={!selectedIds.length || saving}
            onPress={() => void submit()}
            style={[styles.createBtn, !selectedIds.length || saving ? styles.createBtnDim : null]}
          >
            {saving ? <ActivityIndicator color={colors.black} /> : <UserPlus color={colors.black} size={18} strokeWidth={2.8} />}
            <Text style={styles.createBtnText}>{isGroup ? "Create group" : "Start chat"}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// â”€â”€â”€ MESSAGE ACTIONS MODAL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function MessageActionsModal({
  currentUserId,
  message,
  onClose,
  onDelete,
  onEdit,
  onMoreEmoji,
  onPin,
  onReact,
}: {
  currentUserId: string;
  message: Message | null;
  onClose: () => void;
  onDelete: (message: Message) => void;
  onEdit: (message: Message) => void;
  onMoreEmoji: (message: Message) => void;
  onPin: (message: Message) => void;
  onReact: (message: Message, emoji: string) => void;
}) {
  if (!message) return null;
  const mine = message.senderId === currentUserId;

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible>
      <View style={styles.actionLayer}>
        <Pressable accessibilityRole="button" onPress={onClose} style={styles.actionScrim} />
        <View style={styles.actionSheet}>
          <View style={styles.sheetHandle} />

          {/* Message preview */}
          {message.body ? (
            <View style={styles.msgPreview}>
              <Text numberOfLines={3} style={styles.msgPreviewText}>{message.body}</Text>
              <Text style={styles.msgPreviewTime}>{formatShortTime(message.createdAt)}</Text>
            </View>
          ) : null}

          {/* Reaction picker */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.reactionPicker}>
            {reactionOptions.map((emoji) => (
              <Pressable
                accessibilityRole="button"
                key={emoji}
                onPress={() => { onReact(message, emoji); onClose(); }}
                style={styles.reactionBtn}
              >
                <Text style={styles.reactionEmoji}>{emoji}</Text>
              </Pressable>
            ))}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Choose another emoji"
              onPress={() => onMoreEmoji(message)}
              style={[styles.reactionBtn, styles.reactionMoreBtn]}
            >
              <Smile color={colors.accent} size={22} strokeWidth={2.8} />
            </Pressable>
          </ScrollView>

          {/* Actions */}
          <Pressable accessibilityRole="button" onPress={() => { onPin(message); onClose(); }} style={styles.actionRow}>
            <View style={styles.actionIconBox}>
              <Pin color={colors.foreground} size={17} strokeWidth={2.7} />
            </View>
            <Text style={styles.actionText}>{message.pinnedAt ? "Unpin message" : "Pin message"}</Text>
          </Pressable>

          {mine && (
            <Pressable accessibilityRole="button" onPress={() => onEdit(message)} style={styles.actionRow}>
              <View style={styles.actionIconBox}>
                <Edit3 color={colors.foreground} size={17} strokeWidth={2.7} />
              </View>
              <Text style={styles.actionText}>Edit message</Text>
            </Pressable>
          )}

          {mine && (
            <Pressable accessibilityRole="button" onPress={() => onDelete(message)} style={styles.actionRowDanger}>
              <View style={[styles.actionIconBox, styles.actionIconBoxDanger]}>
                <Trash2 color={colors.danger} size={17} strokeWidth={2.7} />
              </View>
              <Text style={styles.actionTextDanger}>Delete message</Text>
            </Pressable>
          )}

          <Pressable accessibilityRole="button" onPress={onClose} style={styles.cancelRow}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// â”€â”€â”€ HELPERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function latestMessage(conversation: Conversation) {
  const msgs = conversation.messages ?? [];
  return [...msgs].sort((a, b) => timestamp(b.createdAt) - timestamp(a.createdAt))[0];
}

function conversationTitle(conversation: Conversation, currentUserId?: string) {
  if (conversation.title?.trim()) return conversation.title.trim();
  const others = conversation.members
    .filter((m) => m.userId !== currentUserId)
    .map((m) => displayUserName(m.user))
    .filter(Boolean);
  if (others.length) return others.join(", ");
  return conversation.isGroup ? "Group conversation" : "Direct message";
}

function conversationSubtitle(conversation: Conversation, currentUserId?: string) {
  const names = conversation.members
    .filter((m) => m.userId !== currentUserId)
    .map((m) => displayUserName(m.user))
    .filter(Boolean);
  return names.length ? names.join(", ") : `${conversation.members.length} members`;
}

function displayUserName(user: Pick<UserSummary, "email" | "firstName" | "lastName"> | TenantUser | null | undefined) {
  if (!user) return "Unknown";
  return `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.email || "Unknown";
}

function initials(user: Pick<UserSummary, "email" | "firstName" | "lastName"> | TenantUser | null | undefined, fallback: string) {
  const source = user
    ? `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`.trim() || user.email.slice(0, 2)
    : fallback.slice(0, 2);
  return source.toUpperCase();
}

const avatarPalette = [
  { bg: colors.blueSoft, text: colors.accent },
  { bg: colors.greenSoft, text: colors.success },
  { bg: colors.yellowSoft, text: "#92720a" },
  { bg: colors.orangeSoft, text: colors.warning },
  { bg: "#f0e6ff", text: "#7c3aed" },
  { bg: "#fce7f3", text: "#be185d" },
];

function initialsColor(name: string): string {
  const index = (name.charCodeAt(0) + (name.charCodeAt(1) ?? 0)) % avatarPalette.length;
  return avatarPalette[index]?.bg ?? colors.blueSoft;
}

function orderMessages(items: Message[]) {
  return [...items].sort((a, b) => timestamp(a.createdAt) - timestamp(b.createdAt));
}

function timestamp(value: string | null | undefined) {
  const parsed = Date.parse(value ?? "");
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatShortTime(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatMessageDate(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === now.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  const oneWeekAgo = new Date(now);
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  if (date > oneWeekAgo) return date.toLocaleDateString([], { weekday: "long" });
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function sameDay(a: string, b: string) {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

function summarizeReactions(reactions: NonNullable<Message["reactions"]>) {
  const map = new Map<string, number>();
  reactions.forEach((r) => map.set(r.emoji, (map.get(r.emoji) ?? 0) + 1));
  return Array.from(map.entries()).map(([emoji, count]) => ({ count, emoji }));
}

function mergeMessageIntoConversations(conversations: Conversation[], message: Message) {
  return conversations.map((c) => {
    if (c.id !== message.conversationId) return c;
    const msgs = [message, ...(c.messages ?? []).filter((m) => m.id !== message.id)].slice(0, 1);
    return {
      ...c,
      messages: msgs,
      _count: {
        ...c._count,
        messages: Math.max(c._count?.messages ?? msgs.length, msgs.length),
      },
    };
  });
}

function messageAttachments(message: Message): ChatAttachment[] {
  if (!Array.isArray(message.attachments)) return [];
  return message.attachments.flatMap((att) => {
    if (!att || typeof att !== "object") return [];
    const source = att as Partial<ChatAttachment>;
    if (typeof source.url !== "string" || typeof source.name !== "string") return [];
    return [{
      kind: source.kind ?? attachmentKind(source.mimeType),
      mimeType: source.mimeType,
      name: source.name,
      sizeBytes: source.sizeBytes,
      url: source.url,
    }];
  });
}

async function uploadPickedAsset(token: string, conversationId: string, asset: PickedAsset): Promise<ChatAttachment> {
  const intent = await createUploadIntent(token, {
    entityId: conversationId,
    entityType: "CONVERSATION",
    fileName: asset.name,
    mimeType: asset.mimeType ?? undefined,
    scope: "CHAT",
    sizeBytes: asset.size ?? undefined,
    visibility: "TEAM",
  });
  const uploadedUrl = await uploadToIntent(intent, asset);
  const url = uploadedUrl || intent.fileUrl;
  const attachment: ChatAttachment = {
    kind: attachmentKind(asset.mimeType),
    mimeType: asset.mimeType,
    name: asset.name,
    sizeBytes: asset.size,
    url,
  };
  if (/^https?:\/\//i.test(url)) {
    void createFileAsset(token, {
      entityId: conversationId,
      entityType: "CONVERSATION",
      fileName: asset.name,
      fileUrl: url,
      mimeType: asset.mimeType ?? undefined,
      provider: intent.provider,
      scope: "CHAT",
      sizeBytes: asset.size ?? undefined,
      storageKey: intent.storageKey,
      visibility: intent.visibility,
    }).catch(() => undefined);
  }
  return attachment;
}

async function uploadToIntent(intent: UploadIntent, asset: PickedAsset) {
  if (!intent.uploadUrl) return undefined;
  if (intent.method === "POST") {
    const form = new FormData();
    Object.entries(intent.fields).forEach(([key, value]) => form.append(key, String(value)));
    form.append("file", { name: asset.name, type: asset.mimeType || "application/octet-stream", uri: asset.uri } as unknown as Blob);
    const response = await fetch(intent.uploadUrl, { body: form, method: "POST" });
    if (!response.ok) throw new Error("Upload provider rejected the file.");
    const payload = await response.json().catch(() => undefined);
    if (payload && typeof payload === "object" && "secure_url" in payload && typeof payload.secure_url === "string") return payload.secure_url;
    if (payload && typeof payload === "object" && "url" in payload && typeof payload.url === "string") return payload.url;
    return undefined;
  }
  const fileResponse = await fetch(asset.uri);
  const blob = await fileResponse.blob();
  const response = await fetch(intent.uploadUrl, { body: blob, headers: intent.headers as Record<string, string>, method: intent.method });
  if (!response.ok) throw new Error("Upload provider rejected the file.");
  return undefined;
}

function attachmentKind(mimeType: string | null | undefined): ChatAttachment["kind"] {
  if (mimeType?.startsWith("image/")) return "image";
  if (mimeType?.startsWith("video/")) return "video";
  if (mimeType?.startsWith("audio/")) return "audio";
  return "file";
}

function attachmentKindLabel(kind: ChatAttachment["kind"]) {
  if (kind === "image") return "Image";
  if (kind === "video") return "Video";
  if (kind === "audio") return "Audio";
  if (kind === "link") return "Link";
  return "File";
}

function formatBytes(value: number | null | undefined) {
  if (!value || value <= 0) return "File";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function normalizeErrorText(message: string | null | undefined, fallback: string) {
  const text = message?.trim() || fallback;
  if (/ThrottlerException|Too Many Requests/i.test(text)) return "Too many requests. Please wait a moment.";
  return text;
}

function errorMessage(caught: unknown, fallback: string) {
  return normalizeErrorText(caught instanceof Error ? caught.message : undefined, fallback);
}

// â”€â”€â”€ STYLES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const styles = StyleSheet.create(withFontStyles({
  screen: {
    backgroundColor: colors.black,
    flex: 1,
  },
  screenBody: {
    backgroundColor: colors.background,
    flex: 1,
  },
  keyboard: {
    backgroundColor: colors.background,
    flex: 1,
  },

  // â”€â”€ Header â”€â”€
  header: {
    alignItems: "center",
    backgroundColor: colors.black,
    borderBottomLeftRadius: radii["2xl"],
    borderBottomRightRadius: radii["2xl"],
    flexDirection: "row",
    gap: 12,
    paddingBottom: 22,
    paddingHorizontal: 18,
    paddingTop: 18,
  },
  headerBtn: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.11)",
    borderRadius: 20,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  headerMark: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.09)",
    borderRadius: 20,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  headerCopy: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  headerMetaRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 5,
  },
  connectionDot: {
    borderRadius: 4,
    height: 7,
    width: 7,
  },
  connectionDotOn: {
    backgroundColor: colors.success,
  },
  connectionDotOff: {
    backgroundColor: "#9a9288",
  },
  eyebrow: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 9,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  headerTitle: {
    color: colors.white,
    fontSize: 19,
    fontWeight: "900",
    lineHeight: 23,
  },
  threadAvatarWrap: {
    height: 42,
    position: "relative",
    width: 42,
  },
  headerAvatarScale: {
    left: -3,
    position: "absolute",
    top: -3,
    transform: [{ scale: 0.88 }],
  },
  onlineDotHeader: {
    backgroundColor: colors.success,
    borderColor: colors.black,
    borderRadius: 7,
    borderWidth: 2.5,
    bottom: 1,
    height: 13,
    position: "absolute",
    right: 1,
    width: 13,
  },
  newBtn: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 22,
    height: 44,
    justifyContent: "center",
    width: 44,
  },

  // â”€â”€ Error â”€â”€
  errorBanner: {
    alignItems: "center",
    backgroundColor: colors.redSoft,
    borderColor: "#fecaca",
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    marginHorizontal: 18,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  errorText: {
    color: colors.danger,
    flex: 1,
    fontSize: 13,
    fontWeight: "900",
  },

  // â”€â”€ Thread â”€â”€
  thread: {
    flex: 1,
  },

  // â”€â”€ Pinned strip â”€â”€
  pinnedStrip: {
    alignItems: "center",
    backgroundColor: colors.yellowSoft,
    borderBottomColor: "#f0d96a",
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  pinnedScroll: {
    gap: 8,
  },
  pinnedChip: {
    backgroundColor: "rgba(255,212,0,0.25)",
    borderColor: "#e7bc0055",
    borderRadius: 12,
    borderWidth: 1,
    maxWidth: 220,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  pinnedChipText: {
    color: "#6b4f00",
    fontSize: 12,
    fontWeight: "900",
  },

  // â”€â”€ Message list â”€â”€
  messageList: {
    gap: 2,
    paddingBottom: 18,
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  messageOuter: {
    gap: 0,
  },

  // â”€â”€ Date divider â”€â”€
  dateDivider: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    marginVertical: 16,
    paddingHorizontal: 4,
  },
  dateDividerLine: {
    backgroundColor: colors.line,
    flex: 1,
    height: 1,
  },
  dateDividerPill: {
    backgroundColor: colors.panelMuted,
    borderColor: colors.line,
    borderRadius: 99,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  dateDividerText: {
    color: colors.inkSoft,
    fontSize: 11,
    fontWeight: "900",
  },

  // â”€â”€ Message wrap â”€â”€
  messageWrap: {
    alignItems: "flex-start",
    gap: 4,
    marginVertical: 3,
  },
  messageWrapMine: {
    alignItems: "flex-end",
  },
  senderName: {
    color: colors.inkSoft,
    fontSize: 11,
    fontWeight: "900",
    marginLeft: 4,
  },
  senderNameMine: {
    marginLeft: 0,
    marginRight: 4,
  },

  // â”€â”€ Message bubble â”€â”€
  messageBubble: {
    borderRadius: radii.xl,
    gap: 5,
    maxWidth: "84%",
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  messageBubbleWide: {
    minWidth: 240,
  },
  messageBubbleMine: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 6,
  },
  messageBubbleOther: {
    backgroundColor: colors.panel,
    borderBottomLeftRadius: 6,
    borderColor: "rgba(16,16,15,0.07)",
    borderWidth: 1,
    ...shadow.card,
  },
  pinnedFlag: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
  },
  pinnedFlagText: {
    color: colors.primaryDark,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  pinnedFlagTextMine: {
    color: "rgba(16,16,15,0.55)",
  },
  messageText: {
    color: colors.foreground,
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 22,
  },
  messageTextMine: {
    color: colors.black,
  },
  messageTime: {
    color: colors.inkSoft,
    fontSize: 10,
    fontWeight: "900",
    textAlign: "right",
  },
  messageTimeMine: {
    color: "rgba(16,16,15,0.58)",
  },

  // â”€â”€ Reactions (outside bubble) â”€â”€
  reactionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
    marginLeft: 6,
  },
  reactionRowMine: {
    justifyContent: "flex-end",
    marginLeft: 0,
    marginRight: 6,
  },
  reactionPill: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 4,
    ...shadow.card,
  },
  reactionText: {
    color: colors.foreground,
    fontSize: 12,
    fontWeight: "900",
  },

  // â”€â”€ Attachment card â”€â”€
  attachmentCard: {
    alignItems: "center",
    alignSelf: "stretch",
    backgroundColor: colors.panelMuted,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    minWidth: 210,
    padding: 10,
  },
  attachmentCardMine: {
    backgroundColor: "rgba(255,255,255,0.52)",
    borderColor: "rgba(16,16,15,0.12)",
  },
  attachmentIconBox: {
    alignItems: "center",
    backgroundColor: colors.blueSoft,
    borderRadius: 14,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  attachmentIconBoxMine: {
    backgroundColor: "rgba(16,16,15,0.1)",
  },
  attachmentCopy: {
    flex: 1,
    minWidth: 0,
  },
  attachmentTitle: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: "900",
  },
  attachmentTitleMine: {
    color: colors.black,
  },
  attachmentSub: {
    color: colors.inkSoft,
    fontSize: 11,
    fontWeight: "800",
    marginTop: 2,
  },
  attachmentSubMine: {
    color: "rgba(16,16,15,0.6)",
  },

  // â”€â”€ Typing bubble â”€â”€
  typingRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
    marginHorizontal: 20,
  },
  typingBubble: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: 5,
    paddingHorizontal: 13,
    paddingVertical: 11,
  },
  typingDot: {
    backgroundColor: colors.line,
    borderRadius: 4,
    height: 7,
    width: 7,
  },
  typingDotActive: {
    backgroundColor: colors.accent,
  },
  typingLabel: {
    color: colors.inkSoft,
    fontSize: 12,
    fontWeight: "800",
  },

  // â”€â”€ Editing bar â”€â”€
  editingBar: {
    alignItems: "center",
    backgroundColor: colors.blueSoft,
    borderRadius: radii.lg,
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
    marginHorizontal: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  editingText: {
    color: colors.accent,
    flex: 1,
    fontSize: 13,
    fontWeight: "900",
  },

  // â”€â”€ Pending attachments â”€â”€
  pendingList: {
    gap: 10,
    paddingBottom: 10,
    paddingHorizontal: 18,
    paddingTop: 4,
  },
  pendingCard: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    minWidth: 230,
    padding: 10,
    ...shadow.card,
  },
  pendingIcon: {
    alignItems: "center",
    backgroundColor: colors.blueSoft,
    borderRadius: 14,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  pendingCopy: {
    flex: 1,
    minWidth: 0,
  },
  pendingTitle: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: "900",
  },
  pendingSub: {
    color: colors.inkSoft,
    fontSize: 11,
    fontWeight: "800",
    marginTop: 2,
  },
  pendingRemove: {
    alignItems: "center",
    backgroundColor: colors.panelMuted,
    borderRadius: 13,
    height: 26,
    justifyContent: "center",
    width: 26,
  },

  // â”€â”€ Composer â”€â”€
  composer: {
    alignItems: "flex-end",
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 30,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    marginBottom: 90,
    marginHorizontal: 16,
    padding: 8,
    ...shadow.heavy,
  },
  composerIconBtn: {
    alignItems: "center",
    backgroundColor: colors.blueSoft,
    borderRadius: 22,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  composerIconBtnActive: {
    backgroundColor: colors.primary,
  },
  composerIconBtnDim: {
    opacity: 0.5,
  },
  composerInput: {
    color: colors.foreground,
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    maxHeight: 120,
    minHeight: 44,
    paddingHorizontal: 10,
    paddingTop: 12,
  },
  sendBtn: {
    alignItems: "center",
    borderRadius: 22,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  sendBtnActive: {
    backgroundColor: colors.primary,
  },
  sendBtnIdle: {
    backgroundColor: colors.panelMuted,
  },

  // â”€â”€ Inbox â”€â”€
  inbox: {
    flex: 1,
  },
  searchBar: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 26,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    marginHorizontal: 18,
    marginTop: 18,
    minHeight: 56,
    paddingHorizontal: 16,
    ...shadow.card,
  },
  searchClear: {
    alignItems: "center",
    backgroundColor: colors.panelMuted,
    borderRadius: 14,
    height: 28,
    justifyContent: "center",
    width: 28,
  },
  searchInput: {
    color: colors.foreground,
    flex: 1,
    fontSize: 15,
    fontWeight: "800",
    minWidth: 0,
  },
  sectionLabel: {
    marginHorizontal: 22,
    marginTop: 18,
    marginBottom: 4,
  },
  sectionLabelText: {
    color: colors.inkSoft,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  conversationList: {
    gap: 10,
    paddingBottom: 120,
    paddingHorizontal: 18,
    paddingTop: 8,
  },

  // â”€â”€ Conversation row â”€â”€
  avatarWrap: {
    position: "relative",
  },
  onlineDot: {
    backgroundColor: colors.success,
    borderColor: colors.panel,
    borderRadius: 7,
    borderWidth: 2.5,
    bottom: 1,
    height: 14,
    position: "absolute",
    right: 1,
    width: 14,
  },
  conversationRow: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderColor: "rgba(16,16,15,0.05)",
    borderRadius: radii.xl,
    borderWidth: 1,
    flexDirection: "row",
    gap: 13,
    padding: 14,
    ...shadow.card,
  },
  conversationBody: {
    flex: 1,
    gap: 5,
    minWidth: 0,
  },
  rowTop: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  conversationTitle: {
    color: colors.foreground,
    flex: 1,
    fontSize: 16,
    fontWeight: "900",
  },
  conversationTime: {
    color: colors.inkSoft,
    fontSize: 11,
    fontWeight: "900",
  },
  conversationPreview: {
    color: colors.inkSoft,
    fontSize: 13,
    fontWeight: "700",
  },

  // â”€â”€ Avatar â”€â”€
  avatarImage: {
    borderRadius: 26,
    height: 52,
    width: 52,
  },
  avatarFallback: {
    alignItems: "center",
    backgroundColor: colors.blueSoft,
    borderRadius: 26,
    height: 52,
    justifyContent: "center",
    width: 52,
  },
  groupAvatar: {
    backgroundColor: "#eef4ff",
  },
  avatarInitials: {
    color: colors.accent,
    fontSize: 16,
    fontWeight: "900",
  },

  // â”€â”€ Loading / empty â”€â”€
  loadingState: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingTop: 80,
  },
  emptyState: {
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 32,
    paddingVertical: 60,
  },
  emptyThread: {
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 32,
    paddingTop: 100,
  },
  emptyIconRing: {
    alignItems: "center",
    backgroundColor: colors.blueSoft,
    borderRadius: 40,
    height: 80,
    justifyContent: "center",
    width: 80,
  },
  emptyTitle: {
    color: colors.foreground,
    fontSize: 20,
    fontWeight: "900",
    textAlign: "center",
  },
  emptyText: {
    color: colors.inkSoft,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 21,
    textAlign: "center",
  },
  emptyBtn: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 22,
    flexDirection: "row",
    gap: 9,
    marginTop: 4,
    paddingHorizontal: 22,
    paddingVertical: 13,
  },
  emptyBtnText: {
    color: colors.black,
    fontSize: 14,
    fontWeight: "900",
  },
  emptySmall: {
    color: colors.inkSoft,
    fontSize: 14,
    fontWeight: "800",
    paddingVertical: 24,
    textAlign: "center",
  },

  // â”€â”€ Sheet (new conversation modal) â”€â”€
  modalLayer: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalScrim: {
    backgroundColor: "rgba(16,16,15,0.32)",
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  modalLoading: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 180,
  },
  sheet: {
    backgroundColor: colors.panel,
    borderTopLeftRadius: radii["2xl"],
    borderTopRightRadius: radii["2xl"],
    gap: 12,
    maxHeight: "88%",
    paddingBottom: 28,
    paddingHorizontal: 22,
    paddingTop: 12,
  },
  sheetHandle: {
    alignSelf: "center",
    backgroundColor: colors.line,
    borderRadius: 99,
    height: 4,
    width: 46,
  },
  sheetHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  sheetEyebrow: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  sheetTitle: {
    color: colors.foreground,
    fontSize: 26,
    fontWeight: "900",
  },
  sheetClose: {
    alignItems: "center",
    backgroundColor: colors.panelMuted,
    borderRadius: 18,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  sheetError: {
    backgroundColor: colors.redSoft,
    borderColor: "#fecaca",
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.danger,
    fontSize: 12,
    fontWeight: "900",
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  searchBarSheet: {
    alignItems: "center",
    backgroundColor: colors.panelMuted,
    borderColor: colors.line,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: 50,
    paddingHorizontal: 14,
  },
  groupNameInput: {
    backgroundColor: colors.panelMuted,
    borderColor: colors.line,
    borderRadius: radii.lg,
    borderWidth: 1,
    color: colors.foreground,
    fontSize: 15,
    fontWeight: "800",
    minHeight: 50,
    paddingHorizontal: 14,
  },
  selectedList: {
    gap: 8,
    paddingVertical: 2,
  },
  selectedPill: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 18,
    flexDirection: "row",
    gap: 6,
    maxWidth: 180,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  selectedPillText: {
    color: colors.black,
    fontSize: 12,
    fontWeight: "900",
  },
  userList: {
    gap: 8,
    paddingBottom: 8,
  },
  userRow: {
    alignItems: "center",
    backgroundColor: colors.panelMuted,
    borderColor: "transparent",
    borderRadius: radii.lg,
    borderWidth: 1.5,
    flexDirection: "row",
    gap: 12,
    padding: 12,
  },
  userRowSelected: {
    backgroundColor: colors.blueSoft,
    borderColor: colors.accent,
  },
  userAvatar: {
    alignItems: "center",
    borderRadius: 22,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  userInitials: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: "900",
  },
  userBody: {
    flex: 1,
    minWidth: 0,
  },
  userName: {
    color: colors.foreground,
    fontSize: 15,
    fontWeight: "900",
  },
  userEmail: {
    color: colors.inkSoft,
    fontSize: 12,
    fontWeight: "700",
  },
  checkBox: {
    alignItems: "center",
    borderColor: colors.line,
    borderRadius: 12,
    borderWidth: 1.5,
    height: 26,
    justifyContent: "center",
    width: 26,
  },
  checkBoxSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  createBtn: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 22,
    flexDirection: "row",
    gap: 10,
    justifyContent: "center",
    minHeight: 54,
    marginTop: 4,
  },
  createBtnDim: {
    opacity: 0.45,
  },
  createBtnText: {
    color: colors.black,
    fontSize: 16,
    fontWeight: "900",
  },

  // â”€â”€ Message actions modal â”€â”€
  actionLayer: {
    flex: 1,
    justifyContent: "flex-end",
  },
  actionScrim: {
    backgroundColor: "rgba(16,16,15,0.38)",
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  actionSheet: {
    backgroundColor: colors.panel,
    borderTopLeftRadius: radii["2xl"],
    borderTopRightRadius: radii["2xl"],
    paddingBottom: 38,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  msgPreview: {
    backgroundColor: colors.panelMuted,
    borderColor: colors.line,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: 4,
    marginBottom: 4,
    marginTop: 12,
    padding: 14,
  },
  msgPreviewText: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
  },
  msgPreviewTime: {
    color: colors.inkSoft,
    fontSize: 11,
    fontWeight: "900",
  },
  reactionPicker: {
    gap: 8,
    paddingVertical: 14,
  },
  reactionBtn: {
    alignItems: "center",
    backgroundColor: colors.panelMuted,
    borderRadius: 18,
    height: 54,
    justifyContent: "center",
    width: 60,
  },
  reactionMoreBtn: {
    backgroundColor: colors.blueSoft,
    borderColor: "rgba(37,99,235,0.18)",
    borderWidth: 1,
  },
  reactionEmoji: {
    fontSize: 26,
  },
  actionRow: {
    alignItems: "center",
    borderTopColor: colors.line,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 13,
    paddingVertical: 15,
  },
  actionRowDanger: {
    alignItems: "center",
    borderTopColor: colors.line,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 13,
    paddingVertical: 15,
  },
  actionIconBox: {
    alignItems: "center",
    backgroundColor: colors.panelMuted,
    borderRadius: 14,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  actionIconBoxDanger: {
    backgroundColor: colors.redSoft,
  },
  actionText: {
    color: colors.foreground,
    fontSize: 15,
    fontWeight: "900",
  },
  actionTextDanger: {
    color: colors.danger,
    fontSize: 15,
    fontWeight: "900",
  },
  cancelRow: {
    alignItems: "center",
    backgroundColor: colors.panelMuted,
    borderRadius: radii.lg,
    marginTop: 8,
    paddingVertical: 16,
  },
  cancelText: {
    color: colors.inkSoft,
    fontSize: 15,
    fontWeight: "900",
  },
}));
