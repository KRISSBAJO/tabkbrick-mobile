import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import {
  Archive,
  ArrowLeft,
  Bot,
  CheckCircle2,
  ChevronRight,
  FolderKanban,
  Gauge,
  History,
  MessageSquare,
  Play,
  RefreshCw,
  Save,
  Search,
  Send,
  Settings2,
  Shield,
  Sparkles,
  Target,
  XCircle,
  Zap,
} from "lucide-react-native";
import {
  archiveAiConversation,
  cancelAiAction,
  detectProjectRisks,
  generateProjectSummary,
  generateSprintPlanning,
  getAiConversation,
  getAiSettings,
  getAiStatus,
  getAiUsageSummary,
  listAiActions,
  listAiAgents,
  listAiConversations,
  listAiUsage,
  listProjects,
  runAiAction,
  searchAiKnowledge,
  sendAiChat,
  sendAiConversationMessage,
  summarizeAiConversation,
  updateAiSettings,
  type AiAction,
  type AiAgent,
  type AiConversation,
  type AiMessage as ApiAiMessage,
  type AiSettings,
  type AiStatus,
  type AiUsageLog,
  type AiUsageSummary,
} from "@/lib/api";
import { useAuthSession } from "@/lib/auth/AuthSessionProvider";
import { withFontStyles } from "@/lib/theme/fontDefaults";
import { colors, fonts, radii, shadow } from "@/lib/theme/tokens";
import type { AuthUser, Project } from "@/lib/types";

type AiMode = "chat" | "knowledge" | "risk" | "sprint" | "summary";
type AiTab = "admin" | "assistant" | "history" | "settings";
type UiMessage = {
  content: string;
  id: string;
  mode: AiMode;
  role: "assistant" | "user";
};
type SettingsForm = {
  defaultModel: string;
  defaultProvider: string;
  enabled: boolean;
  monthlyCostLimit: string;
  monthlyTokenLimit: string;
  redactSensitiveData: boolean;
};

const tabs: { icon: ReactNode; label: string; value: AiTab }[] = [
  { icon: <Sparkles color={colors.foreground} size={15} strokeWidth={2.7} />, label: "Assistant", value: "assistant" },
  { icon: <History color={colors.foreground} size={15} strokeWidth={2.7} />, label: "History", value: "history" },
  { icon: <Settings2 color={colors.foreground} size={15} strokeWidth={2.7} />, label: "Settings", value: "settings" },
  { icon: <Gauge color={colors.foreground} size={15} strokeWidth={2.7} />, label: "Admin", value: "admin" },
];

const modeOptions: {
  accent: string;
  description: string;
  icon: ReactNode;
  label: string;
  mode: AiMode;
  prompt: string;
}[] = [
  {
    accent: colors.primaryDark,
    description: "Persistent workspace chat with saved history.",
    icon: <MessageSquare color={colors.primaryDark} size={17} strokeWidth={2.7} />,
    label: "Chat",
    mode: "chat",
    prompt: "What should I focus on today?",
  },
  {
    accent: colors.success,
    description: "Summarize scope, blockers, and next moves.",
    icon: <Sparkles color={colors.success} size={17} strokeWidth={2.7} />,
    label: "Project summary",
    mode: "summary",
    prompt: "Give me an executive project summary with blockers and next steps.",
  },
  {
    accent: colors.warning,
    description: "Recommend sprint scope and sequencing.",
    icon: <Target color={colors.warning} size={17} strokeWidth={2.7} />,
    label: "Sprint plan",
    mode: "sprint",
    prompt: "Recommend a focused sprint plan using the current project work.",
  },
  {
    accent: colors.danger,
    description: "Detect delivery, schedule, and quality risks.",
    icon: <Shield color={colors.danger} size={17} strokeWidth={2.7} />,
    label: "Risk scan",
    mode: "risk",
    prompt: "Find the top project risks and explain what to do next.",
  },
  {
    accent: "#7c3aed",
    description: "Search tenant work knowledge with AI grounding.",
    icon: <Search color="#7c3aed" size={17} strokeWidth={2.7} />,
    label: "Knowledge",
    mode: "knowledge",
    prompt: "Search our workspace for related decisions, docs, and tasks.",
  },
];

const welcomeMessage: UiMessage = {
  content: "Choose a project, ask a question, or run a focused scan. Chat is saved; project summaries, sprint plans, risk scans, and knowledge searches run as workspace intelligence tasks.",
  id: "welcome",
  mode: "chat",
  role: "assistant",
};

export function AiAssistantScreen() {
  const { accessToken, user } = useAuthSession();
  const params = useLocalSearchParams<{ view?: string }>();
  const canManageAi = useMemo(() => hasAiManagerAccess(user), [user]);
  const initialTab = params.view === "settings" ? "settings" : "assistant";

  const [actions, setActions] = useState<AiAction[]>([]);
  const [activeConversationId, setActiveConversationId] = useState("");
  const [activeTab, setActiveTab] = useState<AiTab>(initialTab);
  const [agents, setAgents] = useState<AiAgent[]>([]);
  const [conversations, setConversations] = useState<AiConversation[]>([]);
  const [error, setError] = useState("");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<UiMessage[]>([welcomeMessage]);
  const [mode, setMode] = useState<AiMode>("chat");
  const [projects, setProjects] = useState<Project[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [running, setRunning] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [settings, setSettings] = useState<AiSettings | null>(null);
  const [settingsForm, setSettingsForm] = useState<SettingsForm>(emptySettingsForm());
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [usage, setUsage] = useState<AiUsageLog[]>([]);
  const [usageSummary, setUsageSummary] = useState<AiUsageSummary | null>(null);

  useEffect(() => {
    if (params.view === "settings") setActiveTab("settings");
  }, [params.view]);

  const load = useCallback(async (showRefreshing = false) => {
    if (!accessToken) return;
    if (showRefreshing) setRefreshing(true);
    else setLoading(true);
    setError("");

    try {
      const [nextStatus, nextSettings, agentPage, projectPage, conversationPage] = await Promise.all([
        getAiStatus(accessToken).catch(() => null),
        getAiSettings(accessToken).catch(() => null),
        listAiAgents(accessToken, { enabled: true, limit: 20 }).catch(() => ({ data: [] as AiAgent[] })),
        listProjects(accessToken, { limit: 20 }),
        listAiConversations(accessToken, { limit: 20 }).catch(() => ({ data: [] as AiConversation[] })),
      ]);

      const nextProjects = Array.isArray(projectPage) ? projectPage : projectPage.data;
      setStatus(nextStatus);
      setSettings(nextSettings);
      if (nextSettings) setSettingsForm(formFromSettings(nextSettings));
      setAgents(Array.isArray(agentPage) ? agentPage : agentPage.data);
      setProjects(nextProjects);
      setConversations(conversationPage.data);
      setSelectedProjectId((current) => current || nextProjects[0]?.id || "");

      if (canManageAi) {
        const [actionPage, usagePage, summary] = await Promise.all([
          listAiActions(accessToken, { limit: 10 }).catch(() => ({ data: [] as AiAction[] })),
          listAiUsage(accessToken, { limit: 10 }).catch(() => ({ data: [] as AiUsageLog[] })),
          getAiUsageSummary(accessToken).catch(() => null),
        ]);
        setActions(actionPage.data);
        setUsage(usagePage.data);
        setUsageSummary(summary);
      } else {
        setActions([]);
        setUsage([]);
        setUsageSummary(null);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load AI workspace.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [accessToken, canManageAi]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? projects[0] ?? null,
    [projects, selectedProjectId],
  );
  const activeMode = modeOptions.find((item) => item.mode === mode) ?? modeOptions[0]!;
  const defaultAgent = agents[0] ?? null;
  const environmentEnabled = status?.enabledByEnvironment ?? true;
  const tenantEnabled = settings?.enabled ?? false;
  const providerConfigured = providerIsConfigured(status, settings?.defaultProvider);
  const aiReady = Boolean(environmentEnabled && tenantEnabled && providerConfigured);
  const disabledReason = getDisabledReason(environmentEnabled, tenantEnabled, providerConfigured, settings);

  function applyPrompt(text: string, nextMode = mode) {
    setMode(nextMode);
    setInput(text);
  }

  function startNewConversation() {
    setActiveConversationId("");
    setInput("");
    setMessages([welcomeMessage]);
    setMode("chat");
    setActiveTab("assistant");
  }

  async function openConversation(conversationId: string) {
    if (!accessToken) return;
    setError("");
    try {
      const conversation = await getAiConversation(accessToken, conversationId);
      setActiveConversationId(conversation.id);
      setMessages(toUiMessages(conversation.messages ?? []));
      setMode("chat");
      setActiveTab("assistant");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to open AI conversation.");
    }
  }

  async function submit() {
    if (!accessToken || running) return;
    const prompt = input.trim() || activeMode.prompt;
    if (!prompt) return;

    if (!aiReady) {
      setError(disabledReason);
      return;
    }

    if (requiresProject(mode) && !selectedProject) {
      setError("Select a project before running this AI mode.");
      return;
    }

    const userMessage: UiMessage = { content: prompt, id: createLocalId("user"), mode, role: "user" };
    setMessages((current) => [...current, userMessage]);
    setInput("");
    setError("");
    setRunning(true);

    try {
      let response: unknown;
      if (mode === "summary") {
        response = await generateProjectSummary(accessToken, {
          agentId: defaultAgent?.id,
          projectId: selectedProject?.id ?? "",
          prompt,
        });
      } else if (mode === "sprint") {
        response = await generateSprintPlanning(accessToken, {
          agentId: defaultAgent?.id,
          projectId: selectedProject?.id ?? "",
          prompt,
        });
      } else if (mode === "risk") {
        response = await detectProjectRisks(accessToken, {
          agentId: defaultAgent?.id,
          projectId: selectedProject?.id ?? "",
          prompt,
        });
      } else if (mode === "knowledge") {
        response = await searchAiKnowledge(accessToken, {
          entityTypes: ["projects", "tasks", "documents"],
          limit: 8,
          query: prompt,
        });
      } else if (activeConversationId) {
        response = await sendAiConversationMessage(accessToken, activeConversationId, {
          content: prompt,
          generateResponse: true,
        });
      } else {
        response = await sendAiChat(accessToken, {
          agentId: defaultAgent?.id,
          content: prompt,
          contextId: selectedProject?.id,
          contextType: selectedProject ? "project" : "workspace",
        });
        const newConversationId = readConversationId(response);
        if (newConversationId) setActiveConversationId(newConversationId);
      }

      setMessages((current) => [
        ...current,
        { content: normalizeAiResponse(response), id: createLocalId("assistant"), mode, role: "assistant" },
      ]);
      void load(true);
    } catch (caught) {
      setMessages((current) => [
        ...current,
        {
          content: caught instanceof Error ? caught.message : "The AI request failed.",
          id: createLocalId("assistant"),
          mode,
          role: "assistant",
        },
      ]);
    } finally {
      setRunning(false);
    }
  }

  async function saveSettings() {
    if (!accessToken || !canManageAi || savingSettings) return;
    setSavingSettings(true);
    setError("");
    try {
      const updated = await updateAiSettings(accessToken, {
        defaultModel: settingsForm.defaultModel.trim() || "gpt-4o-mini",
        defaultProvider: settingsForm.defaultProvider.trim() || "openai",
        enabled: settingsForm.enabled,
        monthlyCostLimit: optionalNumber(settingsForm.monthlyCostLimit),
        monthlyTokenLimit: optionalNumber(settingsForm.monthlyTokenLimit),
        redactSensitiveData: settingsForm.redactSensitiveData,
      });
      setSettings(updated);
      setSettingsForm(formFromSettings(updated));
      void load(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save AI settings.");
    } finally {
      setSavingSettings(false);
    }
  }

  async function summarizeActiveConversation() {
    if (!accessToken || !activeConversationId) return;
    setRunning(true);
    setError("");
    try {
      const conversation = await summarizeAiConversation(accessToken, activeConversationId);
      setConversations((current) => current.map((item) => (item.id === conversation.id ? conversation : item)));
      setMessages((current) => [
        ...current,
        {
          content: conversation.summary ?? "Conversation summary saved.",
          id: createLocalId("assistant"),
          mode: "summary",
          role: "assistant",
        },
      ]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to summarize conversation.");
    } finally {
      setRunning(false);
    }
  }

  async function archiveConversation(conversationId: string) {
    if (!accessToken) return;
    setError("");
    try {
      await archiveAiConversation(accessToken, conversationId);
      setConversations((current) => current.filter((item) => item.id !== conversationId));
      if (activeConversationId === conversationId) startNewConversation();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to archive conversation.");
    }
  }

  async function runAction(actionId: string) {
    if (!accessToken) return;
    setError("");
    try {
      const updated = await runAiAction(accessToken, actionId);
      setActions((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to run AI action.");
    }
  }

  async function cancelAction(actionId: string) {
    if (!accessToken) return;
    setError("");
    try {
      const updated = await cancelAiAction(accessToken, actionId);
      setActions((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to cancel AI action.");
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl onRefresh={() => void load(true)} refreshing={refreshing} tintColor={colors.primary} />}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <View style={styles.heroTop}>
              <Pressable accessibilityRole="button" onPress={() => router.push("/(workspace)")} style={styles.heroIconBtn}>
                <ArrowLeft color={colors.white} size={20} strokeWidth={2.8} />
              </Pressable>
              <View style={styles.heroTitleWrap}>
                <Text style={styles.heroEyebrow}>Workspace AI</Text>
                <Text style={styles.heroTitle}>Intelligence command</Text>
                <Text style={styles.heroSubtitle}>Chat, plan, search, and monitor tenant AI safely.</Text>
              </View>
              <Pressable accessibilityRole="button" disabled={loading || refreshing} onPress={() => void load(true)} style={styles.heroIconBtn}>
                <RefreshCw color={colors.white} size={18} strokeWidth={2.7} />
              </Pressable>
            </View>

            <View style={styles.aiVisualRow}>
              <View style={styles.aiVisual}>
                <View style={styles.aiGlow} />
                <View style={styles.aiCore}>
                  <Bot color={colors.black} size={30} strokeWidth={2.7} />
                </View>
                <View style={[styles.aiNode, styles.aiNodeOne]} />
                <View style={[styles.aiNode, styles.aiNodeTwo]} />
                <View style={[styles.aiNode, styles.aiNodeThree]} />
              </View>
              <View style={styles.heroSignal}>
                <Text style={styles.signalValue}>{aiReady ? "Live" : "Paused"}</Text>
                <Text style={styles.signalText}>{aiReady ? "Tenant AI is ready" : disabledReason}</Text>
              </View>
            </View>

            <View style={styles.statusStrip}>
              <StatusBit label={aiReady ? "Ready" : "Disabled"} tone={aiReady ? "green" : "red"} value={settings?.defaultProvider ?? status?.defaultProvider ?? "openai"} />
              <View style={styles.statusDivider} />
              <StatusBit label="Model" tone="yellow" value={settings?.defaultModel ?? "Not set"} />
              <View style={styles.statusDivider} />
              <StatusBit label="Agents" tone="blue" value={String(agents.length)} />
            </View>
          </View>

          <ScrollView contentContainerStyle={styles.tabRail} horizontal showsHorizontalScrollIndicator={false}>
            {tabs.map((tab) => {
              const locked = tab.value === "admin" && !canManageAi;
              const active = activeTab === tab.value;
              return (
                <Pressable
                  accessibilityRole="button"
                  disabled={locked}
                  key={tab.value}
                  onPress={() => setActiveTab(tab.value)}
                  style={[styles.tabChip, active && styles.tabChipActive, locked && styles.tabChipLocked]}
                >
                  {tab.icon}
                  <Text style={[styles.tabText, active && styles.tabTextActive]}>{tab.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {!aiReady ? (
            <DisabledNotice
              canManageAi={canManageAi}
              reason={disabledReason}
              onOpenSettings={() => setActiveTab("settings")}
            />
          ) : null}

          {activeTab === "assistant" ? (
            <AssistantTab
              activeConversationId={activeConversationId}
              activeMode={activeMode}
              applyPrompt={applyPrompt}
              input={input}
              loading={loading}
              messages={messages}
              mode={mode}
              projects={projects}
              running={running}
              selectedProject={selectedProject}
              setInput={setInput}
              setMode={setMode}
              setSelectedProjectId={setSelectedProjectId}
              startNewConversation={startNewConversation}
              submit={submit}
              summarizeActiveConversation={summarizeActiveConversation}
            />
          ) : null}

          {activeTab === "history" ? (
            <HistoryTab
              activeConversationId={activeConversationId}
              conversations={conversations}
              loading={loading}
              onArchive={(conversationId) => void archiveConversation(conversationId)}
              onOpen={(conversationId) => void openConversation(conversationId)}
              onStart={startNewConversation}
            />
          ) : null}

          {activeTab === "settings" ? (
            <SettingsTab
              canManageAi={canManageAi}
              environmentEnabled={environmentEnabled}
              form={settingsForm}
              providerConfigured={providerConfigured}
              saving={savingSettings}
              setForm={setSettingsForm}
              settings={settings}
              status={status}
              onSave={() => void saveSettings()}
            />
          ) : null}

          {activeTab === "admin" ? (
            <AdminTab
              actions={actions}
              canManageAi={canManageAi}
              onCancel={(actionId) => void cancelAction(actionId)}
              onRun={(actionId) => void runAction(actionId)}
              usage={usage}
              usageSummary={usageSummary}
            />
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function AssistantTab({
  activeConversationId,
  activeMode,
  applyPrompt,
  input,
  loading,
  messages,
  mode,
  projects,
  running,
  selectedProject,
  setInput,
  setMode,
  setSelectedProjectId,
  startNewConversation,
  submit,
  summarizeActiveConversation,
}: {
  activeConversationId: string;
  activeMode: (typeof modeOptions)[number];
  applyPrompt: (text: string, nextMode?: AiMode) => void;
  input: string;
  loading: boolean;
  messages: UiMessage[];
  mode: AiMode;
  projects: Project[];
  running: boolean;
  selectedProject: Project | null;
  setInput: (value: string) => void;
  setMode: (value: AiMode) => void;
  setSelectedProjectId: (value: string) => void;
  startNewConversation: () => void;
  submit: () => void;
  summarizeActiveConversation: () => void;
}) {
  return (
    <>
      <View style={styles.panel}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Capability</Text>
          {loading ? <ActivityIndicator color={colors.accent} size="small" /> : null}
        </View>
        <ScrollView contentContainerStyle={styles.modeRail} horizontal showsHorizontalScrollIndicator={false}>
          {modeOptions.map((item) => {
            const active = item.mode === mode;
            return (
              <Pressable
                accessibilityRole="button"
                key={item.mode}
                onPress={() => setMode(item.mode)}
                style={[styles.modeChip, active && { backgroundColor: item.accent, borderColor: item.accent }]}
              >
                {item.icon}
                <Text style={[styles.modeChipText, active && styles.modeChipTextActive]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <Text style={styles.modeDescription}>{activeMode.description}</Text>
      </View>

      <View style={styles.panel}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Project context</Text>
          <Text style={styles.sectionMeta}>{selectedProject ? selectedProject.key : "Workspace"}</Text>
        </View>
        <ScrollView contentContainerStyle={styles.projectRail} horizontal showsHorizontalScrollIndicator={false}>
          {projects.map((project) => {
            const active = project.id === selectedProject?.id;
            return (
              <Pressable
                accessibilityRole="button"
                key={project.id}
                onPress={() => setSelectedProjectId(project.id)}
                style={[styles.projectChip, active && styles.projectChipActive]}
              >
                <FolderKanban color={active ? colors.black : colors.accent} size={15} strokeWidth={2.5} />
                <Text numberOfLines={1} style={[styles.projectChipText, active && styles.projectChipTextActive]}>{project.name}</Text>
              </Pressable>
            );
          })}
          {!projects.length && !loading ? (
            <View style={styles.projectEmpty}>
              <Text style={styles.projectEmptyText}>Create a project to unlock project-aware AI scans.</Text>
            </View>
          ) : null}
        </ScrollView>
      </View>

      <View style={styles.panel}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Prompt</Text>
          <Text style={styles.sectionMeta}>{activeConversationId ? "Saved chat" : activeMode.label}</Text>
        </View>
        <TextInput
          multiline
          onChangeText={setInput}
          placeholder={activeMode.prompt}
          placeholderTextColor={colors.inkSoft}
          style={styles.promptInput}
          value={input}
        />
        <View style={styles.suggestionRail}>
          {modeOptions.slice(1, 4).map((item) => (
            <Pressable
              accessibilityRole="button"
              key={item.mode}
              onPress={() => applyPrompt(item.prompt, item.mode)}
              style={styles.suggestionChip}
            >
              <Text style={styles.suggestionText}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.promptActions}>
          <Pressable accessibilityRole="button" onPress={startNewConversation} style={styles.secondaryBtn}>
            <Zap color={colors.foreground} size={16} strokeWidth={2.7} />
            <Text style={styles.secondaryBtnText}>New</Text>
          </Pressable>
          <Pressable accessibilityRole="button" disabled={!activeConversationId || running} onPress={summarizeActiveConversation} style={[styles.secondaryBtn, (!activeConversationId || running) && styles.disabledBtn]}>
            <Sparkles color={colors.foreground} size={16} strokeWidth={2.7} />
            <Text style={styles.secondaryBtnText}>Summarize</Text>
          </Pressable>
          <Pressable accessibilityRole="button" disabled={running} onPress={submit} style={[styles.runBtn, running && styles.disabledBtn]}>
            {running ? <ActivityIndicator color={colors.black} size="small" /> : <Send color={colors.black} size={17} strokeWidth={2.7} />}
            <Text style={styles.runBtnText}>{running ? "Thinking..." : "Run AI"}</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.thread}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>AI output</Text>
          <Text style={styles.sectionMeta}>{messages.length} messages</Text>
        </View>
        {messages.map((message) => (
          <View key={message.id} style={[styles.message, message.role === "user" ? styles.userMessage : styles.assistantMessage]}>
            <View style={styles.messageTop}>
              <Text style={[styles.messageRole, message.role === "user" && styles.userRole]}>{message.role === "user" ? "You" : labelForMode(message.mode)}</Text>
              {message.role === "assistant" ? <CheckCircle2 color={colors.success} size={14} strokeWidth={2.5} /> : null}
            </View>
            <Text style={[styles.messageText, message.role === "user" && styles.userMessageText]}>{message.content}</Text>
          </View>
        ))}
      </View>
    </>
  );
}

function HistoryTab({
  activeConversationId,
  conversations,
  loading,
  onArchive,
  onOpen,
  onStart,
}: {
  activeConversationId: string;
  conversations: AiConversation[];
  loading: boolean;
  onArchive: (conversationId: string) => void;
  onOpen: (conversationId: string) => void;
  onStart: () => void;
}) {
  return (
    <View style={styles.panel}>
      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>Saved conversations</Text>
          <Text style={styles.sectionMeta}>{conversations.length} recent AI threads</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={onStart} style={styles.smallYellowBtn}>
          <Text style={styles.smallYellowText}>New</Text>
        </Pressable>
      </View>

      {loading ? <ActivityIndicator color={colors.accent} style={styles.listLoader} /> : null}
      {!loading && !conversations.length ? (
        <EmptyState icon={<History color={colors.accent} size={30} strokeWidth={2.5} />} title="No saved AI chats" text="Ask a chat question and it will appear here." />
      ) : null}
      {conversations.map((conversation) => (
        <View key={conversation.id} style={[styles.conversationRow, activeConversationId === conversation.id && styles.conversationRowActive]}>
          <Pressable accessibilityRole="button" onPress={() => onOpen(conversation.id)} style={styles.conversationMain}>
            <View style={styles.conversationIcon}>
              <MessageSquare color={colors.accent} size={17} strokeWidth={2.6} />
            </View>
            <View style={styles.conversationText}>
              <Text numberOfLines={1} style={styles.conversationTitle}>{conversation.title || "AI conversation"}</Text>
              <Text numberOfLines={1} style={styles.conversationMeta}>
                {conversation.agent?.name ?? "Assistant"} - {conversation._count?.messages ?? conversation.messages?.length ?? 0} messages - {formatDate(conversation.updatedAt)}
              </Text>
            </View>
            <ChevronRight color={colors.inkSoft} size={16} strokeWidth={2.6} />
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => onArchive(conversation.id)} style={styles.archiveBtn}>
            <Archive color={colors.inkSoft} size={16} strokeWidth={2.6} />
          </Pressable>
        </View>
      ))}
    </View>
  );
}

function SettingsTab({
  canManageAi,
  environmentEnabled,
  form,
  providerConfigured,
  saving,
  setForm,
  settings,
  status,
  onSave,
}: {
  canManageAi: boolean;
  environmentEnabled: boolean;
  form: SettingsForm;
  providerConfigured: boolean;
  saving: boolean;
  setForm: (updater: (current: SettingsForm) => SettingsForm) => void;
  settings: AiSettings | null;
  status: AiStatus | null;
  onSave: () => void;
}) {
  return (
    <>
      <View style={styles.panel}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Tenant AI controls</Text>
            <Text style={styles.sectionMeta}>{canManageAi ? "Owner/admin access" : "Read-only"}</Text>
          </View>
          <StatusDot ok={Boolean(environmentEnabled && form.enabled && providerConfigured)} />
        </View>
        {!canManageAi ? (
          <View style={styles.lockBox}>
            <Shield color={colors.warning} size={18} strokeWidth={2.7} />
            <Text style={styles.lockText}>Only tenant owners or users with manage:ai can change these settings.</Text>
          </View>
        ) : null}
        <SettingsLine label="Environment" value={environmentEnabled ? "AI_ENABLED=true" : "AI_ENABLED=false"} ok={environmentEnabled} />
        <SettingsLine label="Provider key" value={providerConfigured ? "Configured" : "Missing"} ok={providerConfigured} />
        <SettingsLine label="Tenant setting" value={settings?.enabled ? "Enabled" : "Disabled"} ok={Boolean(settings?.enabled)} />
      </View>

      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>Provider setup</Text>
        <ToggleRow
          disabled={!canManageAi}
          label="Enable tenant AI"
          onChange={(enabled) => setForm((current) => ({ ...current, enabled }))}
          value={form.enabled}
        />
        <ToggleRow
          disabled={!canManageAi}
          label="Redact sensitive data"
          onChange={(redactSensitiveData) => setForm((current) => ({ ...current, redactSensitiveData }))}
          value={form.redactSensitiveData}
        />
        <View style={styles.fieldGroup}>
          <FieldLabel label="Provider" />
          <View style={styles.choiceRow}>
            {["openai", "local", "anthropic"].map((provider) => (
              <Pressable
                accessibilityRole="button"
                disabled={!canManageAi}
                key={provider}
                onPress={() => setForm((current) => ({ ...current, defaultProvider: provider }))}
                style={[styles.choiceChip, form.defaultProvider === provider && styles.choiceChipActive, !canManageAi && styles.disabledBtn]}
              >
                <Text style={[styles.choiceText, form.defaultProvider === provider && styles.choiceTextActive]}>{provider}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        <SettingsInput
          editable={canManageAi}
          label="Model"
          onChangeText={(defaultModel) => setForm((current) => ({ ...current, defaultModel }))}
          placeholder="gpt-4o-mini"
          value={form.defaultModel}
        />
        <View style={styles.twoCol}>
          <SettingsInput
            editable={canManageAi}
            keyboardType="number-pad"
            label="Monthly tokens"
            onChangeText={(monthlyTokenLimit) => setForm((current) => ({ ...current, monthlyTokenLimit }))}
            placeholder="Optional"
            value={form.monthlyTokenLimit}
          />
          <SettingsInput
            editable={canManageAi}
            keyboardType="decimal-pad"
            label="Monthly cost"
            onChangeText={(monthlyCostLimit) => setForm((current) => ({ ...current, monthlyCostLimit }))}
            placeholder="Optional"
            value={form.monthlyCostLimit}
          />
        </View>
        <Pressable accessibilityRole="button" disabled={!canManageAi || saving} onPress={onSave} style={[styles.saveBtn, (!canManageAi || saving) && styles.disabledBtn]}>
          {saving ? <ActivityIndicator color={colors.black} size="small" /> : <Save color={colors.black} size={17} strokeWidth={2.7} />}
          <Text style={styles.saveBtnText}>{saving ? "Saving..." : "Save AI settings"}</Text>
        </Pressable>
      </View>

      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>Environment status</Text>
        <Text style={styles.codeText}>{JSON.stringify(status?.configured ?? {}, null, 2)}</Text>
      </View>
    </>
  );
}

function AdminTab({
  actions,
  canManageAi,
  onCancel,
  onRun,
  usage,
  usageSummary,
}: {
  actions: AiAction[];
  canManageAi: boolean;
  onCancel: (actionId: string) => void;
  onRun: (actionId: string) => void;
  usage: AiUsageLog[];
  usageSummary: AiUsageSummary | null;
}) {
  if (!canManageAi) {
    return (
      <View style={styles.panel}>
        <EmptyState icon={<Shield color={colors.warning} size={30} strokeWidth={2.6} />} title="Admin only" text="AI usage and action audit are available to tenant owners and AI managers." />
      </View>
    );
  }

  return (
    <>
      <View style={styles.metricsPanel}>
        <MetricBlock label="Requests" value={usageSummary?.totals?.requests ?? usage.length} />
        <MetricBlock label="Tokens" value={usageSummary?.totals?.totalTokens ?? 0} />
        <MetricBlock label="Cost" value={`$${Number(usageSummary?.totals?.estimatedCost ?? 0).toFixed(2)}`} />
      </View>

      <View style={styles.panel}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>AI actions</Text>
          <Text style={styles.sectionMeta}>{actions.length} recent</Text>
        </View>
        {!actions.length ? <EmptyState icon={<Play color={colors.accent} size={28} strokeWidth={2.6} />} title="No AI actions" text="Auditable AI actions will appear here." /> : null}
        {actions.map((action) => (
          <View key={action.id} style={styles.auditRow}>
            <View style={styles.auditMain}>
              <Text numberOfLines={1} style={styles.auditTitle}>{action.type}</Text>
              <Text numberOfLines={1} style={styles.auditMeta}>{action.status} - {formatDate(action.createdAt)}</Text>
              {action.error ? <Text numberOfLines={2} style={styles.auditError}>{action.error}</Text> : null}
            </View>
            {action.status === "PENDING" || action.status === "RUNNING" ? (
              <View style={styles.auditActions}>
                <Pressable accessibilityRole="button" onPress={() => onRun(action.id)} style={styles.iconAuditBtn}>
                  <Play color={colors.success} size={15} strokeWidth={2.7} />
                </Pressable>
                <Pressable accessibilityRole="button" onPress={() => onCancel(action.id)} style={styles.iconAuditBtn}>
                  <XCircle color={colors.danger} size={15} strokeWidth={2.7} />
                </Pressable>
              </View>
            ) : null}
          </View>
        ))}
      </View>

      <View style={styles.panel}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent usage</Text>
          <Text style={styles.sectionMeta}>{usage.length} logs</Text>
        </View>
        {!usage.length ? <EmptyState icon={<Gauge color={colors.accent} size={28} strokeWidth={2.6} />} title="No usage yet" text="AI requests will create usage records." /> : null}
        {usage.map((item) => (
          <View key={item.id} style={styles.usageRow}>
            <View>
              <Text style={styles.usageTitle}>{item.requestType}</Text>
              <Text style={styles.usageMeta}>{item.provider} - {item.model} - {formatDate(item.createdAt)}</Text>
            </View>
            <Text style={styles.usageTokens}>{item.totalTokens ?? 0}</Text>
          </View>
        ))}
      </View>
    </>
  );
}

function DisabledNotice({ canManageAi, onOpenSettings, reason }: { canManageAi: boolean; onOpenSettings: () => void; reason: string }) {
  return (
    <View style={styles.disabledNotice}>
      <Shield color={colors.warning} size={20} strokeWidth={2.7} />
      <View style={styles.disabledNoticeText}>
        <Text style={styles.disabledTitle}>AI is not ready</Text>
        <Text style={styles.disabledBody}>{reason}</Text>
      </View>
      {canManageAi ? (
        <Pressable accessibilityRole="button" onPress={onOpenSettings} style={styles.noticeBtn}>
          <Text style={styles.noticeBtnText}>Fix</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function StatusBit({ label, tone, value }: { label: string; tone: "blue" | "green" | "red" | "yellow"; value: string }) {
  const accent = tone === "green" ? colors.success : tone === "red" ? colors.danger : tone === "yellow" ? colors.primaryDark : colors.accent;
  return (
    <View style={styles.statusBit}>
      <Text style={[styles.statusValue, { color: accent }]} numberOfLines={1}>{value}</Text>
      <Text style={styles.statusLabel}>{label}</Text>
    </View>
  );
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <View style={[styles.statusDot, { backgroundColor: ok ? colors.greenSoft : colors.redSoft }]}>
      {ok ? <CheckCircle2 color={colors.success} size={16} strokeWidth={2.7} /> : <XCircle color={colors.danger} size={16} strokeWidth={2.7} />}
      <Text style={[styles.statusDotText, { color: ok ? colors.success : colors.danger }]}>{ok ? "Ready" : "Blocked"}</Text>
    </View>
  );
}

function SettingsLine({ label, ok, value }: { label: string; ok: boolean; value: string }) {
  return (
    <View style={styles.settingsLine}>
      <Text style={styles.settingsLineLabel}>{label}</Text>
      <View style={styles.settingsLineValue}>
        {ok ? <CheckCircle2 color={colors.success} size={15} strokeWidth={2.7} /> : <XCircle color={colors.danger} size={15} strokeWidth={2.7} />}
        <Text style={styles.settingsLineText}>{value}</Text>
      </View>
    </View>
  );
}

function ToggleRow({ disabled, label, onChange, value }: { disabled?: boolean; label: string; onChange: (value: boolean) => void; value: boolean }) {
  return (
    <Pressable accessibilityRole="switch" disabled={disabled} onPress={() => onChange(!value)} style={[styles.toggleRow, disabled && styles.disabledBtn]}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <View style={[styles.toggleTrack, value && styles.toggleTrackActive]}>
        <View style={[styles.toggleKnob, value && styles.toggleKnobActive]} />
      </View>
    </Pressable>
  );
}

function SettingsInput({
  editable,
  keyboardType,
  label,
  onChangeText,
  placeholder,
  value,
}: {
  editable: boolean;
  keyboardType?: "decimal-pad" | "number-pad";
  label: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  return (
    <View style={styles.fieldGroup}>
      <FieldLabel label={label} />
      <TextInput
        editable={editable}
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.inkSoft}
        style={[styles.settingsInput, !editable && styles.settingsInputDisabled]}
        value={value}
      />
    </View>
  );
}

function FieldLabel({ label }: { label: string }) {
  return <Text style={styles.fieldLabel}>{label}</Text>;
}

function EmptyState({ icon, text, title }: { icon: ReactNode; text: string; title: string }) {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}>{icon}</View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

function MetricBlock({ label, value }: { label: string; value: number | string }) {
  return (
    <View style={styles.metricBlock}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function requiresProject(mode: AiMode) {
  return mode === "summary" || mode === "sprint" || mode === "risk";
}

function labelForMode(mode: AiMode) {
  return modeOptions.find((item) => item.mode === mode)?.label ?? "AI";
}

function createLocalId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function toUiMessages(messages: ApiAiMessage[]): UiMessage[] {
  const converted = messages.map((message) => ({
    content: message.content,
    id: message.id,
    mode: "chat" as const,
    role: /user/i.test(message.role) ? "user" as const : "assistant" as const,
  }));
  return converted.length ? converted : [welcomeMessage];
}

function normalizeAiResponse(payload: unknown): string {
  const record = asRecord(payload);
  const assistantMessage = asRecord(record.assistantMessage);
  if (typeof assistantMessage.content === "string" && assistantMessage.content.trim()) return assistantMessage.content.trim();
  const direct = readLikelyText(payload);
  if (direct) return direct;
  if (payload === null || payload === undefined) return "The AI request completed, but the API did not return displayable text.";

  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    return String(payload);
  }
}

function readLikelyText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (!value || typeof value !== "object") return "";
  if (Array.isArray(value)) {
    return value.map(readLikelyText).filter(Boolean).join("\n\n");
  }

  const record = value as Record<string, unknown>;
  const likelyKeys = ["content", "narrative", "text", "answer", "summary", "result", "output", "response"];
  for (const key of likelyKeys) {
    const nested = readLikelyText(record[key]);
    if (nested) return nested;
  }

  if (Array.isArray(record.findings)) {
    return record.findings.map((item, index) => {
      const itemRecord = asRecord(item);
      const title = readLikelyText(itemRecord.title) || `Finding ${index + 1}`;
      const evidence = readLikelyText(itemRecord.evidence);
      return evidence ? `- ${title}: ${evidence}` : `- ${title}`;
    }).join("\n");
  }

  if (Array.isArray(record.data)) {
    return record.data
      .map((item, index) => {
        if (typeof item === "string") return `- ${item}`;
        const itemRecord = asRecord(item);
        const title = readLikelyText(itemRecord.title) || readLikelyText(itemRecord.name) || readLikelyText(itemRecord.key) || `Result ${index + 1}`;
        const body = readLikelyText(itemRecord.subtitle) || readLikelyText(itemRecord.description) || readLikelyText(itemRecord.content);
        return body ? `- ${title}: ${body}` : `- ${title}`;
      })
      .filter(Boolean)
      .join("\n");
  }

  return "";
}

function readConversationId(payload: unknown) {
  const conversation = asRecord(asRecord(payload).conversation);
  return typeof conversation.id === "string" ? conversation.id : "";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function emptySettingsForm(): SettingsForm {
  return {
    defaultModel: "gpt-4o-mini",
    defaultProvider: "openai",
    enabled: false,
    monthlyCostLimit: "",
    monthlyTokenLimit: "",
    redactSensitiveData: true,
  };
}

function formFromSettings(settings: AiSettings): SettingsForm {
  return {
    defaultModel: settings.defaultModel ?? "gpt-4o-mini",
    defaultProvider: settings.defaultProvider ?? "openai",
    enabled: settings.enabled,
    monthlyCostLimit: settings.monthlyCostLimit === null || settings.monthlyCostLimit === undefined ? "" : String(settings.monthlyCostLimit),
    monthlyTokenLimit: settings.monthlyTokenLimit === null || settings.monthlyTokenLimit === undefined ? "" : String(settings.monthlyTokenLimit),
    redactSensitiveData: settings.redactSensitiveData,
  };
}

function optionalNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function providerIsConfigured(status: AiStatus | null, provider?: string) {
  if (!status || !provider) return true;
  const configured = asRecord(status.configured);
  const value = configured[provider];
  return typeof value === "boolean" ? value : true;
}

function getDisabledReason(environmentEnabled: boolean, tenantEnabled: boolean, providerConfigured: boolean, settings: AiSettings | null) {
  if (!environmentEnabled) return "The backend is running with AI_ENABLED=false. Restart the backend after setting AI_ENABLED=true.";
  if (settings && !tenantEnabled) return "AI is disabled for this tenant. A tenant owner can enable it in AI settings.";
  if (!providerConfigured) return "The selected AI provider is missing its server-side API key.";
  if (!settings) return "AI settings could not be loaded for this user. Check read:ai permission.";
  return "AI is not ready.";
}

function hasAiManagerAccess(user: AuthUser | null) {
  if (!user) return false;
  if (user.isPlatformAdmin) return true;
  const permissions = new Set(user.permissions ?? []);
  if (permissions.has("manage:ai") || permissions.has("manage:all")) return true;
  return (user.roles ?? []).some((role) => /owner|admin/i.test(role));
}

function formatDate(value?: string | null) {
  if (!value) return "Now";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Now";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const styles = StyleSheet.create(withFontStyles({
  safe: { backgroundColor: colors.black, flex: 1 },
  flex: { flex: 1 },
  content: { backgroundColor: colors.background, gap: 16, paddingBottom: 128, paddingHorizontal: 18, paddingTop: 0 },
  hero: {
    backgroundColor: colors.black,
    borderBottomLeftRadius: 34,
    borderBottomRightRadius: 34,
    gap: 16,
    marginHorizontal: -18,
    paddingBottom: 24,
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  heroTop: { alignItems: "center", flexDirection: "row", gap: 12 },
  heroIconBtn: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 18,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  heroTitleWrap: { flex: 1, minWidth: 0 },
  heroEyebrow: { color: colors.primary, fontFamily: fonts.extraBold, fontSize: 11, fontWeight: "900", letterSpacing: 1, textTransform: "uppercase" },
  heroTitle: { color: colors.white, fontFamily: fonts.extraBold, fontSize: 27, fontWeight: "900" },
  heroSubtitle: { color: "rgba(255,255,255,0.62)", fontFamily: fonts.semiBold, fontSize: 12, fontWeight: "700", lineHeight: 18, marginTop: 3 },
  aiVisualRow: { alignItems: "center", flexDirection: "row", gap: 16 },
  aiVisual: { alignItems: "center", height: 112, justifyContent: "center", width: 126 },
  aiGlow: { backgroundColor: "rgba(255,205,0,0.16)", borderRadius: 76, height: 152, position: "absolute", width: 152 },
  aiCore: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 34,
    height: 68,
    justifyContent: "center",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.44,
    shadowRadius: 24,
    width: 68,
  },
  aiNode: { backgroundColor: colors.white, borderRadius: 999, height: 9, opacity: 0.68, position: "absolute", width: 9 },
  aiNodeOne: { left: 18, top: 18 },
  aiNodeTwo: { right: 16, top: 36 },
  aiNodeThree: { bottom: 16, left: 86 },
  heroSignal: { flex: 1, gap: 6, minWidth: 0 },
  signalValue: { color: colors.white, fontFamily: fonts.extraBold, fontSize: 23, fontWeight: "900" },
  signalText: { color: "rgba(255,255,255,0.62)", fontFamily: fonts.semiBold, fontSize: 12, fontWeight: "800", lineHeight: 18 },
  statusStrip: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.09)",
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: "row",
    paddingVertical: 12,
  },
  statusBit: { alignItems: "center", flex: 1, gap: 4, minWidth: 0 },
  statusDivider: { backgroundColor: "rgba(255,255,255,0.16)", height: 28, width: 1 },
  statusLabel: { color: "rgba(255,255,255,0.58)", fontFamily: fonts.extraBold, fontSize: 9, fontWeight: "900", letterSpacing: 0.7, textTransform: "uppercase" },
  statusValue: { fontFamily: fonts.extraBold, fontSize: 13, fontWeight: "900", maxWidth: 92, textAlign: "center" },
  tabRail: { gap: 9, paddingRight: 10 },
  tabChip: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 7,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  tabChipActive: { backgroundColor: colors.primary, borderColor: colors.primaryDark },
  tabChipLocked: { opacity: 0.46 },
  tabText: { color: colors.foreground, fontFamily: fonts.extraBold, fontSize: 12, fontWeight: "900" },
  tabTextActive: { color: colors.black },
  errorBox: { backgroundColor: colors.redSoft, borderColor: "#fecaca", borderRadius: radii.xl, borderWidth: 1, padding: 14 },
  errorText: { color: colors.danger, fontFamily: fonts.extraBold, fontSize: 13, fontWeight: "900", lineHeight: 18 },
  disabledNotice: { alignItems: "center", backgroundColor: colors.orangeSoft, borderColor: "#fed7aa", borderRadius: radii.xl, borderWidth: 1, flexDirection: "row", gap: 12, padding: 14 },
  disabledNoticeText: { flex: 1, gap: 3, minWidth: 0 },
  disabledTitle: { color: colors.foreground, fontFamily: fonts.extraBold, fontSize: 13, fontWeight: "900" },
  disabledBody: { color: colors.warning, fontFamily: fonts.semiBold, fontSize: 12, fontWeight: "800", lineHeight: 17 },
  noticeBtn: { backgroundColor: colors.primary, borderRadius: 999, paddingHorizontal: 15, paddingVertical: 8 },
  noticeBtnText: { color: colors.black, fontFamily: fonts.extraBold, fontSize: 12, fontWeight: "900" },
  panel: { backgroundColor: colors.panel, borderColor: colors.line, borderRadius: radii["2xl"], borderWidth: 1, gap: 13, padding: 16, ...shadow.card },
  sectionHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", gap: 12 },
  sectionTitle: { color: colors.foreground, fontFamily: fonts.extraBold, fontSize: 16, fontWeight: "900" },
  sectionMeta: { color: colors.inkSoft, fontFamily: fonts.semiBold, fontSize: 11, fontWeight: "800" },
  modeRail: { gap: 9, paddingRight: 8 },
  modeChip: { alignItems: "center", backgroundColor: colors.white, borderColor: colors.line, borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 7, paddingHorizontal: 13, paddingVertical: 10 },
  modeChipText: { color: colors.foreground, fontFamily: fonts.extraBold, fontSize: 12, fontWeight: "900" },
  modeChipTextActive: { color: colors.white },
  modeDescription: { color: colors.inkSoft, fontFamily: fonts.semiBold, fontSize: 12, fontWeight: "700", lineHeight: 18 },
  projectRail: { gap: 8, paddingRight: 8 },
  projectChip: { alignItems: "center", backgroundColor: colors.white, borderColor: colors.line, borderRadius: 18, borderWidth: 1, flexDirection: "row", gap: 7, maxWidth: 190, paddingHorizontal: 12, paddingVertical: 10 },
  projectChipActive: { backgroundColor: colors.primary, borderColor: colors.primaryDark },
  projectChipText: { color: colors.foreground, flexShrink: 1, fontFamily: fonts.extraBold, fontSize: 12, fontWeight: "900" },
  projectChipTextActive: { color: colors.black },
  projectEmpty: { backgroundColor: colors.panelMuted, borderRadius: 18, padding: 13 },
  projectEmptyText: { color: colors.inkSoft, fontSize: 12, fontWeight: "800" },
  promptInput: {
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: 20,
    borderWidth: 1,
    color: colors.foreground,
    fontFamily: fonts.semiBold,
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 22,
    minHeight: 116,
    padding: 16,
    textAlignVertical: "top",
  },
  suggestionRail: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  suggestionChip: { backgroundColor: colors.panelMuted, borderColor: colors.line, borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
  suggestionText: { color: colors.foreground, fontFamily: fonts.extraBold, fontSize: 11, fontWeight: "900" },
  promptActions: { flexDirection: "row", gap: 9 },
  secondaryBtn: { alignItems: "center", backgroundColor: colors.panelMuted, borderColor: colors.line, borderRadius: 18, borderWidth: 1, flexDirection: "row", gap: 7, minHeight: 52, paddingHorizontal: 14 },
  secondaryBtnText: { color: colors.foreground, fontFamily: fonts.extraBold, fontSize: 12, fontWeight: "900" },
  runBtn: { alignItems: "center", backgroundColor: colors.primary, borderColor: colors.primaryDark, borderRadius: 18, borderWidth: 1, flex: 1, flexDirection: "row", gap: 8, justifyContent: "center", minHeight: 52 },
  runBtnText: { color: colors.black, fontFamily: fonts.extraBold, fontSize: 14, fontWeight: "900" },
  saveBtn: { alignItems: "center", backgroundColor: colors.primary, borderColor: colors.primaryDark, borderRadius: 20, borderWidth: 1, flexDirection: "row", gap: 8, height: 54, justifyContent: "center" },
  saveBtnText: { color: colors.black, fontFamily: fonts.extraBold, fontSize: 14, fontWeight: "900" },
  disabledBtn: { opacity: 0.55 },
  thread: { gap: 12 },
  message: { borderRadius: 24, gap: 8, padding: 16 },
  assistantMessage: { backgroundColor: colors.panel, borderColor: colors.line, borderWidth: 1, ...shadow.card },
  userMessage: { alignSelf: "flex-end", backgroundColor: colors.primary, maxWidth: "88%" },
  messageTop: { alignItems: "center", flexDirection: "row", gap: 6, justifyContent: "space-between" },
  messageRole: { color: colors.accent, fontFamily: fonts.extraBold, fontSize: 11, fontWeight: "900", letterSpacing: 0.7, textTransform: "uppercase" },
  userRole: { color: colors.black },
  messageText: { color: colors.foreground, fontFamily: fonts.semiBold, fontSize: 14, fontWeight: "700", lineHeight: 21 },
  userMessageText: { color: colors.black, fontFamily: fonts.extraBold, fontWeight: "900" },
  listLoader: { paddingVertical: 20 },
  conversationRow: { backgroundColor: colors.panelMuted, borderColor: colors.line, borderRadius: 20, borderWidth: 1, flexDirection: "row", gap: 6, padding: 8 },
  conversationRowActive: { borderColor: colors.primaryDark },
  conversationMain: { alignItems: "center", flex: 1, flexDirection: "row", gap: 11, minWidth: 0 },
  conversationIcon: { alignItems: "center", backgroundColor: colors.blueSoft, borderRadius: 15, height: 42, justifyContent: "center", width: 42 },
  conversationText: { flex: 1, gap: 3, minWidth: 0 },
  conversationTitle: { color: colors.foreground, fontFamily: fonts.extraBold, fontSize: 14, fontWeight: "900" },
  conversationMeta: { color: colors.inkSoft, fontFamily: fonts.semiBold, fontSize: 11, fontWeight: "700" },
  archiveBtn: { alignItems: "center", borderRadius: 14, justifyContent: "center", width: 38 },
  smallYellowBtn: { backgroundColor: colors.primary, borderColor: colors.primaryDark, borderRadius: 999, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8 },
  smallYellowText: { color: colors.black, fontFamily: fonts.extraBold, fontSize: 12, fontWeight: "900" },
  lockBox: { alignItems: "center", backgroundColor: colors.orangeSoft, borderRadius: 18, flexDirection: "row", gap: 10, padding: 12 },
  lockText: { color: colors.warning, flex: 1, fontFamily: fonts.semiBold, fontSize: 12, fontWeight: "800", lineHeight: 17 },
  statusDot: { alignItems: "center", borderRadius: 999, flexDirection: "row", gap: 6, paddingHorizontal: 11, paddingVertical: 7 },
  statusDotText: { fontFamily: fonts.extraBold, fontSize: 11, fontWeight: "900" },
  settingsLine: { alignItems: "center", borderTopColor: colors.line, borderTopWidth: 1, flexDirection: "row", justifyContent: "space-between", minHeight: 44 },
  settingsLineLabel: { color: colors.inkSoft, fontFamily: fonts.semiBold, fontSize: 12, fontWeight: "800" },
  settingsLineValue: { alignItems: "center", flexDirection: "row", gap: 6 },
  settingsLineText: { color: colors.foreground, fontFamily: fonts.extraBold, fontSize: 12, fontWeight: "900" },
  toggleRow: { alignItems: "center", borderColor: colors.line, borderRadius: 18, borderWidth: 1, flexDirection: "row", justifyContent: "space-between", padding: 14 },
  toggleLabel: { color: colors.foreground, fontFamily: fonts.extraBold, fontSize: 13, fontWeight: "900" },
  toggleTrack: { backgroundColor: colors.line, borderRadius: 999, height: 28, justifyContent: "center", paddingHorizontal: 3, width: 52 },
  toggleTrackActive: { backgroundColor: colors.primary },
  toggleKnob: { backgroundColor: colors.white, borderRadius: 999, height: 22, width: 22 },
  toggleKnobActive: { alignSelf: "flex-end", backgroundColor: colors.black },
  fieldGroup: { flex: 1, gap: 7 },
  fieldLabel: { color: colors.foreground, fontFamily: fonts.extraBold, fontSize: 12, fontWeight: "900" },
  settingsInput: { backgroundColor: colors.white, borderColor: colors.line, borderRadius: 18, borderWidth: 1, color: colors.foreground, fontFamily: fonts.semiBold, fontSize: 14, fontWeight: "800", minHeight: 52, paddingHorizontal: 14 },
  settingsInputDisabled: { color: colors.inkSoft, opacity: 0.72 },
  choiceRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  choiceChip: { backgroundColor: colors.white, borderColor: colors.line, borderRadius: 999, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10 },
  choiceChipActive: { backgroundColor: colors.black, borderColor: colors.black },
  choiceText: { color: colors.foreground, fontFamily: fonts.extraBold, fontSize: 12, fontWeight: "900", textTransform: "capitalize" },
  choiceTextActive: { color: colors.white },
  twoCol: { flexDirection: "row", gap: 10 },
  codeText: { backgroundColor: colors.panelMuted, borderRadius: 16, color: colors.foreground, fontFamily: fonts.semiBold, fontSize: 12, fontWeight: "700", lineHeight: 18, padding: 13 },
  metricsPanel: { backgroundColor: colors.panel, borderColor: colors.line, borderRadius: radii["2xl"], borderWidth: 1, flexDirection: "row", overflow: "hidden", ...shadow.card },
  metricBlock: { alignItems: "center", flex: 1, gap: 4, paddingVertical: 16 },
  metricValue: { color: colors.foreground, fontFamily: fonts.extraBold, fontSize: 18, fontWeight: "900" },
  metricLabel: { color: colors.inkSoft, fontFamily: fonts.extraBold, fontSize: 10, fontWeight: "900", letterSpacing: 0.5, textTransform: "uppercase" },
  auditRow: { alignItems: "center", borderTopColor: colors.line, borderTopWidth: 1, flexDirection: "row", gap: 10, paddingVertical: 12 },
  auditMain: { flex: 1, gap: 3, minWidth: 0 },
  auditTitle: { color: colors.foreground, fontFamily: fonts.extraBold, fontSize: 13, fontWeight: "900" },
  auditMeta: { color: colors.inkSoft, fontFamily: fonts.semiBold, fontSize: 11, fontWeight: "800" },
  auditError: { color: colors.danger, fontFamily: fonts.semiBold, fontSize: 11, fontWeight: "800" },
  auditActions: { flexDirection: "row", gap: 6 },
  iconAuditBtn: { alignItems: "center", backgroundColor: colors.panelMuted, borderRadius: 13, height: 34, justifyContent: "center", width: 34 },
  usageRow: { alignItems: "center", borderTopColor: colors.line, borderTopWidth: 1, flexDirection: "row", justifyContent: "space-between", paddingVertical: 12 },
  usageTitle: { color: colors.foreground, fontFamily: fonts.extraBold, fontSize: 13, fontWeight: "900" },
  usageMeta: { color: colors.inkSoft, fontFamily: fonts.semiBold, fontSize: 11, fontWeight: "800", marginTop: 2 },
  usageTokens: { color: colors.accent, fontFamily: fonts.extraBold, fontSize: 14, fontWeight: "900" },
  emptyState: { alignItems: "center", gap: 8, paddingVertical: 24 },
  emptyIcon: { alignItems: "center", backgroundColor: colors.blueSoft, borderRadius: 22, height: 52, justifyContent: "center", width: 52 },
  emptyTitle: { color: colors.foreground, fontFamily: fonts.extraBold, fontSize: 15, fontWeight: "900" },
  emptyText: { color: colors.inkSoft, fontFamily: fonts.semiBold, fontSize: 12, fontWeight: "800", lineHeight: 18, maxWidth: 260, textAlign: "center" },
}));
