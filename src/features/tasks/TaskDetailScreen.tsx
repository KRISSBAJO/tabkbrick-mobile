import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ActivityIndicator, Alert, Linking, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, type Href } from "expo-router";
import {
  ArrowLeft,
  Archive,
  CalendarDays,
  CheckCircle2,
  CheckSquare2,
  Eye,
  FileText,
  Link2,
  MessageSquare,
  Paperclip,
  Plus,
  RotateCcw,
  Send,
  ShieldAlert,
  Tag,
  Trash2,
  Users,
  X,
} from "lucide-react-native";
import { StatusPill } from "@/components/ui/StatusPill";
import {
  addTaskAssignee,
  addTaskWatcher,
  archiveTask,
  assignTaskLabel,
  createLabel,
  createTaskAttachment,
  createTaskChecklist,
  createTaskChecklistItem,
  createTaskComment,
  createTaskDependency,
  deleteTask,
  deleteTaskAttachment,
  deleteTaskChecklist,
  deleteTaskChecklistItem,
  deleteTaskComment,
  deleteTaskDependency,
  getTask,
  listLabels,
  listTaskActivities,
  listTaskAssignees,
  listTaskAttachments,
  listTaskChecklists,
  listTaskComments,
  listTaskDependencies,
  listTaskLabels,
  listTaskWatchers,
  listTasks,
  listUsers,
  removeTaskAssignee,
  removeTaskLabel,
  removeTaskWatcher,
  restoreTask,
  updateTaskChecklistItem,
  updateTask,
} from "@/lib/api";
import { useAuthSession } from "@/lib/auth/AuthSessionProvider";
import { withFontStyles } from "@/lib/theme/fontDefaults";
import { colors, radii, shadow } from "@/lib/theme/tokens";
import type {
  Task,
  TaskActivity,
  TaskAssignee,
  TaskAttachment,
  TaskChecklist,
  TaskComment,
  TaskDependency,
  TaskLabel,
  TaskLabelAssignment,
  TaskWatcher,
  TenantUser,
} from "@/lib/types";
import {
  displayUserName,
  formatCompactDate,
  formatShortDate,
  humanPriority,
  humanStatus,
  statusTone,
  taskPriorities,
  taskStatuses,
  taskTypes,
} from "./taskFilters";

type TaskAction =
  | "addAssignee"
  | "addAttachment"
  | "addChecklist"
  | "addChecklistItem"
  | "addDependency"
  | "addLabel"
  | "addWatcher"
  | "createLabel"
  | "editTask"
  | null;

type DraftState = {
  color: string;
  description: string;
  dueDate: string;
  estimateHours: string;
  fileName: string;
  fileUrl: string;
  labelName: string;
  mimeType: string;
  search: string;
  storyPoints: string;
  text: string;
  title: string;
  type: Task["type"];
};

type TaskDetailData = {
  activities: TaskActivity[];
  assignees: TaskAssignee[];
  attachments: TaskAttachment[];
  checklists: TaskChecklist[];
  comments: TaskComment[];
  dependencies: { blockedBy: TaskDependency[]; blocking: TaskDependency[] };
  labels: TaskLabelAssignment[];
  task: Task;
  watchers: TaskWatcher[];
};

export function TaskDetailScreen({ returnTo, taskId }: { returnTo?: string; taskId: string }) {
  const { accessToken } = useAuthSession();
  const [commentDraft, setCommentDraft] = useState("");
  const [data, setData] = useState<TaskDetailData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [action, setAction] = useState<TaskAction>(null);
  const [actionContextId, setActionContextId] = useState<string | null>(null);
  const [tenantLabels, setTenantLabels] = useState<TaskLabel[]>([]);
  const [tenantUsers, setTenantUsers] = useState<TenantUser[]>([]);
  const [taskOptions, setTaskOptions] = useState<Task[]>([]);
  const [draft, setDraft] = useState<DraftState>({
    color: "#2563eb",
    description: "",
    dueDate: "",
    estimateHours: "",
    fileName: "",
    fileUrl: "",
    labelName: "",
    mimeType: "",
    search: "",
    storyPoints: "",
    text: "",
    title: "",
    type: "TASK",
  });

  const load = useCallback(async (showRefreshing = false) => {
    if (!accessToken || !taskId) return;
    if (showRefreshing) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const [task, comments, activities, checklists, attachments, dependencies, labels, assignees, watchers] =
        await Promise.all([
          getTask(accessToken, taskId),
          safe(listTaskComments(accessToken, taskId), []),
          safe(listTaskActivities(accessToken, taskId), []),
          safe(listTaskChecklists(accessToken, taskId), []),
          safe(listTaskAttachments(accessToken, taskId), []),
          safe(listTaskDependencies(accessToken, taskId), { blockedBy: [], blocking: [] }),
          safe(listTaskLabels(accessToken, taskId), []),
          safe(listTaskAssignees(accessToken, taskId), []),
          safe(listTaskWatchers(accessToken, taskId), []),
        ]);
      setData({ activities, assignees, attachments, checklists, comments, dependencies, labels, task, watchers });
      const [usersPage, labelsList, tasksPage] = await Promise.all([
        safe(listUsers(accessToken, { limit: 100, page: 1 }), { data: [], limit: 100, page: 1, total: 0, totalPages: 0 }),
        safe(listLabels(accessToken), []),
        safe(listTasks(accessToken, { limit: 100, page: 1 }), { data: [], limit: 100, page: 1, total: 0, totalPages: 0 }),
      ]);
      setTenantUsers(usersPage.data ?? []);
      setTenantLabels(labelsList);
      setTaskOptions((tasksPage.data ?? []).filter((candidate) => candidate.id !== taskId));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load task.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [accessToken, taskId]);

  useEffect(() => { void load(); }, [load]);

  const task = data?.task;
  const checklistTotals = useMemo(() => {
    const total = data?.checklists.reduce((s, cl) => s + cl.items.length, 0) ?? 0;
    const done = data?.checklists.reduce((s, cl) => s + cl.items.filter((i) => i.isDone).length, 0) ?? 0;
    return { done, total };
  }, [data?.checklists]);

  const assignedUserIds = useMemo(() => new Set(data?.assignees.map((item) => item.user.id) ?? []), [data?.assignees]);
  const watcherUserIds = useMemo(() => new Set(data?.watchers.map((item) => item.userId ?? item.user?.id).filter(Boolean) as string[]), [data?.watchers]);
  const assignedLabelIds = useMemo(() => new Set(data?.labels.map((item) => item.label.id) ?? []), [data?.labels]);

  const filteredUsers = useMemo(() => {
    const query = draft.search.trim().toLowerCase();
    if (!query) return tenantUsers;
    return tenantUsers.filter((user) => `${displayUserName(user)} ${user.email}`.toLowerCase().includes(query));
  }, [draft.search, tenantUsers]);

  const filteredLabels = useMemo(() => {
    const query = draft.search.trim().toLowerCase();
    if (!query) return tenantLabels;
    return tenantLabels.filter((label) => label.name.toLowerCase().includes(query));
  }, [draft.search, tenantLabels]);

  const filteredTaskOptions = useMemo(() => {
    const query = draft.search.trim().toLowerCase();
    if (!query) return taskOptions;
    return taskOptions.filter((candidate) => `${candidate.key} ${candidate.title} ${candidate.project?.name ?? ""}`.toLowerCase().includes(query));
  }, [draft.search, taskOptions]);

  async function quickUpdate(patch: Partial<Pick<Task, "priority" | "status">>) {
    if (!accessToken || !task) return;
    setSaving(true);
    setError("");
    try {
      const updated = await updateTask(accessToken, task.id, patch);
      setData((cur) => (cur ? { ...cur, task: { ...cur.task, ...updated } } : cur));
      await load(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update task.");
    } finally {
      setSaving(false);
    }
  }

  async function submitComment() {
    if (!accessToken || !task || !commentDraft.trim()) return;
    setSaving(true);
    setError("");
    try {
      await createTaskComment(accessToken, task.id, { body: commentDraft.trim() });
      setCommentDraft("");
      await load(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to add comment.");
    } finally {
      setSaving(false);
    }
  }

  function openAction(nextAction: Exclude<TaskAction, null>, contextId?: string) {
    setAction(nextAction);
    setActionContextId(contextId ?? null);
    const editDefaults = nextAction === "editTask" && task ? {
      description: task.description ?? "",
      dueDate: task.dueDate ? String(task.dueDate).slice(0, 10) : "",
      estimateHours: task.estimateMins ? String(task.estimateMins / 60) : "",
      storyPoints: task.storyPoints ? String(task.storyPoints) : "",
      title: task.title,
      type: task.type,
    } : null;
    setDraft({
      color: "#2563eb",
      description: editDefaults?.description ?? "",
      dueDate: editDefaults?.dueDate ?? "",
      estimateHours: editDefaults?.estimateHours ?? "",
      fileName: "",
      fileUrl: "",
      labelName: "",
      mimeType: "",
      search: "",
      storyPoints: editDefaults?.storyPoints ?? "",
      text: "",
      title: editDefaults?.title ?? "",
      type: editDefaults?.type ?? "TASK",
    });
    setError("");
  }

  function closeAction() {
    setAction(null);
    setActionContextId(null);
  }

  async function runMutation(work: () => Promise<unknown>, fallback: string, close = false) {
    if (!accessToken || !task) return;
    setSaving(true);
    setError("");
    try {
      await work();
      if (close) closeAction();
      await load(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : fallback);
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateChecklist() {
    if (!draft.title.trim() || !accessToken || !task) return;
    await runMutation(
      () => createTaskChecklist(accessToken, task.id, { title: draft.title.trim() }),
      "Unable to create checklist.",
      true,
    );
  }

  async function handleCreateChecklistItem() {
    if (!draft.text.trim() || !actionContextId || !accessToken || !task) return;
    await runMutation(
      () => createTaskChecklistItem(accessToken, task.id, actionContextId, { text: draft.text.trim() }),
      "Unable to add checklist item.",
      true,
    );
  }

  async function handleCreateAttachment() {
    if (!draft.fileUrl.trim() || !accessToken || !task) return;
    const fileUrl = draft.fileUrl.trim();
    const fallbackName = fileUrl.split("/").filter(Boolean).pop() ?? "Linked file";
    await runMutation(
      () => createTaskAttachment(accessToken, task.id, {
        fileName: draft.fileName.trim() || fallbackName,
        fileUrl,
        mimeType: draft.mimeType.trim() || undefined,
      }),
      "Unable to link task file.",
      true,
    );
  }

  async function handleCreateLabelAndAssign() {
    if (!draft.labelName.trim() || !accessToken || !task) return;
    await runMutation(async () => {
      const label = await createLabel(accessToken, { name: draft.labelName.trim(), color: draft.color.trim() || undefined });
      await assignTaskLabel(accessToken, task.id, label.id);
    }, "Unable to create label.", true);
  }

  async function handleUpdateTaskCore() {
    if (!accessToken || !task || !draft.title.trim()) return;
    const estimate = Number(draft.estimateHours);
    const storyPoints = Number.parseInt(draft.storyPoints, 10);
    await runMutation(
      () => updateTask(accessToken, task.id, {
        description: draft.description.trim() || undefined,
        dueDate: draft.dueDate.trim() || null,
        estimateMins: Number.isFinite(estimate) && estimate > 0 ? Math.round(estimate * 60) : undefined,
        storyPoints: Number.isFinite(storyPoints) && storyPoints >= 0 ? storyPoints : undefined,
        title: draft.title.trim(),
        type: draft.type,
      }),
      "Unable to update task.",
      true,
    );
  }

  function confirmDelete(title: string, message: string, onConfirm: () => void) {
    Alert.alert(title, message, [
      { style: "cancel", text: "Cancel" },
      { onPress: onConfirm, style: "destructive", text: "Delete" },
    ]);
  }

  function confirmArchive() {
    Alert.alert("Archive task", "Archive this task for the workspace?", [
      { style: "cancel", text: "Cancel" },
      {
        onPress: () => void runMutation(() => archiveTask(accessToken!, task!.id), "Unable to archive task."),
        text: "Archive",
      },
    ]);
  }

  function confirmDeleteTask() {
    Alert.alert("Delete task", "This removes the task from active work. Continue?", [
      { style: "cancel", text: "Cancel" },
      {
        onPress: () => void deleteCurrentTask(),
        style: "destructive",
        text: "Delete",
      },
    ]);
  }

  async function deleteCurrentTask() {
    if (!accessToken || !task) return;
    setSaving(true);
    setError("");
    try {
      await deleteTask(accessToken, task.id);
      router.replace((returnTo as Href) || "/(workspace)/tasks");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to delete task.");
    } finally {
      setSaving(false);
    }
  }

  function renderActionModal() {
    if (!action || !task) return null;
    const userAction = action === "addAssignee" || action === "addWatcher";
    const title = actionTitle(action);
    const subtitle = actionSubtitle(action);

    return (
      <Modal animationType="slide" onRequestClose={closeAction} transparent visible={Boolean(action)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalEyebrow}>Task management</Text>
                <Text style={styles.modalTitle}>{title}</Text>
                <Text style={styles.modalSubtitle}>{subtitle}</Text>
              </View>
              <Pressable accessibilityRole="button" onPress={closeAction} style={styles.modalClose}>
                <X color={colors.foreground} size={20} strokeWidth={2.8} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.modalBody} showsVerticalScrollIndicator={false}>
              {userAction ? (
                <>
                  <ManagedInput
                    label="Find user"
                    onChangeText={(search) => setDraft((current) => ({ ...current, search }))}
                    placeholder="Search name or email"
                    value={draft.search}
                  />
                  <View style={styles.optionStack}>
                    {filteredUsers.slice(0, 50).map((user) => {
                      const selected = action === "addAssignee" ? assignedUserIds.has(user.id) : watcherUserIds.has(user.id);
                      return (
                        <Pressable
                          accessibilityRole="button"
                          disabled={selected || saving}
                          key={user.id}
                          onPress={() => void runMutation(
                            () => action === "addAssignee"
                              ? addTaskAssignee(accessToken!, task.id, user.id)
                              : addTaskWatcher(accessToken!, task.id, user.id),
                            action === "addAssignee" ? "Unable to add assignee." : "Unable to add watcher.",
                            true,
                          )}
                          style={[styles.optionRow, selected && styles.optionRowDisabled]}
                        >
                          <View style={styles.optionAvatar}>
                            <Text style={styles.optionAvatarText}>{initials(user)}</Text>
                          </View>
                          <View style={styles.optionTextBlock}>
                            <Text numberOfLines={1} style={styles.optionTitle}>{displayUserName(user)}</Text>
                            <Text numberOfLines={1} style={styles.optionMeta}>{user.email}</Text>
                          </View>
                          <Text style={selected ? styles.optionSelectedText : styles.optionAddText}>{selected ? "Added" : "Add"}</Text>
                        </Pressable>
                      );
                    })}
                    {!filteredUsers.length ? <Text style={styles.emptyText}>No matching users.</Text> : null}
                  </View>
                </>
              ) : null}

              {action === "addLabel" ? (
                <>
                  <ManagedInput
                    label="Find label"
                    onChangeText={(search) => setDraft((current) => ({ ...current, search }))}
                    placeholder="Search label"
                    value={draft.search}
                  />
                  <Pressable accessibilityRole="button" onPress={() => openAction("createLabel")} style={styles.createInline}>
                    <Plus color={colors.black} size={16} strokeWidth={3} />
                    <Text style={styles.createInlineText}>Create new label</Text>
                  </Pressable>
                  <View style={styles.optionStack}>
                    {filteredLabels.slice(0, 50).map((label) => {
                      const selected = assignedLabelIds.has(label.id);
                      return (
                        <Pressable
                          accessibilityRole="button"
                          disabled={selected || saving}
                          key={label.id}
                          onPress={() => void runMutation(
                            () => assignTaskLabel(accessToken!, task.id, label.id),
                            "Unable to assign label.",
                            true,
                          )}
                          style={[styles.optionRow, selected && styles.optionRowDisabled]}
                        >
                          <View style={[styles.labelSwatch, { backgroundColor: label.color ?? colors.primary }]} />
                          <Text numberOfLines={1} style={styles.optionTitle}>{label.name}</Text>
                          <Text style={selected ? styles.optionSelectedText : styles.optionAddText}>{selected ? "Added" : "Add"}</Text>
                        </Pressable>
                      );
                    })}
                    {!filteredLabels.length ? <Text style={styles.emptyText}>No labels found.</Text> : null}
                  </View>
                </>
              ) : null}

              {action === "createLabel" ? (
                <>
                  <ManagedInput label="Label name" onChangeText={(labelName) => setDraft((current) => ({ ...current, labelName }))} placeholder="Customer risk" value={draft.labelName} />
                  <ManagedInput label="Color" onChangeText={(color) => setDraft((current) => ({ ...current, color }))} placeholder="#2563eb" value={draft.color} />
                  <PrimaryModalButton disabled={!draft.labelName.trim() || saving} label={saving ? "Creating..." : "Create and add"} onPress={() => void handleCreateLabelAndAssign()} />
                </>
              ) : null}

              {action === "addChecklist" ? (
                <>
                  <ManagedInput label="Checklist title" onChangeText={(titleValue) => setDraft((current) => ({ ...current, title: titleValue }))} placeholder="Acceptance checklist" value={draft.title} />
                  <PrimaryModalButton disabled={!draft.title.trim() || saving} label={saving ? "Creating..." : "Create checklist"} onPress={() => void handleCreateChecklist()} />
                </>
              ) : null}

              {action === "addChecklistItem" ? (
                <>
                  <ManagedInput label="Checklist item" onChangeText={(text) => setDraft((current) => ({ ...current, text }))} placeholder="Confirm staging deployment" value={draft.text} />
                  <PrimaryModalButton disabled={!draft.text.trim() || saving} label={saving ? "Adding..." : "Add item"} onPress={() => void handleCreateChecklistItem()} />
                </>
              ) : null}

              {action === "addAttachment" ? (
                <>
                  <ManagedInput label="File or link name" onChangeText={(fileName) => setDraft((current) => ({ ...current, fileName }))} placeholder="Release notes" value={draft.fileName} />
                  <ManagedInput label="URL" onChangeText={(fileUrl) => setDraft((current) => ({ ...current, fileUrl }))} placeholder="https://..." value={draft.fileUrl} />
                  <ManagedInput label="MIME type" onChangeText={(mimeType) => setDraft((current) => ({ ...current, mimeType }))} placeholder="application/pdf" value={draft.mimeType} />
                  <PrimaryModalButton disabled={!draft.fileUrl.trim() || saving} label={saving ? "Linking..." : "Link file"} onPress={() => void handleCreateAttachment()} />
                </>
              ) : null}

              {action === "editTask" ? (
                <>
                  <ManagedInput label="Title" onChangeText={(titleValue) => setDraft((current) => ({ ...current, title: titleValue }))} placeholder="Task title" value={draft.title} />
                  <View style={styles.managedInputBlock}>
                    <Text style={styles.managedInputLabel}>Description</Text>
                    <TextInput
                      multiline
                      onChangeText={(description) => setDraft((current) => ({ ...current, description }))}
                      placeholder="Context, acceptance notes, or handoff details"
                      placeholderTextColor={colors.inkSoft}
                      style={[styles.managedInput, styles.managedTextArea]}
                      value={draft.description}
                    />
                  </View>
                  <View style={styles.typeRail}>
                    {taskTypes.map((type) => (
                      <Pressable
                        accessibilityRole="button"
                        key={type}
                        onPress={() => setDraft((current) => ({ ...current, type }))}
                        style={[styles.typeChip, draft.type === type && styles.typeChipActive]}
                      >
                        <Text style={[styles.typeChipText, draft.type === type && styles.typeChipTextActive]}>{humanStatus(type)}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <ManagedInput label="Due date" onChangeText={(dueDate) => setDraft((current) => ({ ...current, dueDate }))} placeholder="YYYY-MM-DD or blank" value={draft.dueDate} />
                  <View style={styles.modalTwoCol}>
                    <ManagedInput label="Story points" onChangeText={(storyPoints) => setDraft((current) => ({ ...current, storyPoints }))} placeholder="0" value={draft.storyPoints} />
                    <ManagedInput label="Estimate hours" onChangeText={(estimateHours) => setDraft((current) => ({ ...current, estimateHours }))} placeholder="0" value={draft.estimateHours} />
                  </View>
                  <PrimaryModalButton disabled={!draft.title.trim() || saving} label={saving ? "Updating..." : "Update task"} onPress={() => void handleUpdateTaskCore()} />
                </>
              ) : null}

              {action === "addDependency" ? (
                <>
                  <ManagedInput
                    label="Find task"
                    onChangeText={(search) => setDraft((current) => ({ ...current, search }))}
                    placeholder="Search key, title, or project"
                    value={draft.search}
                  />
                  <View style={styles.optionStack}>
                    {filteredTaskOptions.slice(0, 60).map((candidate) => (
                      <Pressable
                        accessibilityRole="button"
                        key={candidate.id}
                        onPress={() => void runMutation(
                          () => createTaskDependency(accessToken!, task.id, { toTaskId: candidate.id, type: "BLOCKS" }),
                          "Unable to create dependency.",
                          true,
                        )}
                        style={styles.optionRow}
                      >
                        <View style={styles.optionTaskKey}>
                          <Text style={styles.optionTaskKeyText}>{candidate.key}</Text>
                        </View>
                        <View style={styles.optionTextBlock}>
                          <Text numberOfLines={1} style={styles.optionTitle}>{candidate.title}</Text>
                          <Text numberOfLines={1} style={styles.optionMeta}>{candidate.project?.name ?? "Task"} · {humanStatus(candidate.status)}</Text>
                        </View>
                        <Text style={styles.optionAddText}>Link</Text>
                      </Pressable>
                    ))}
                    {!filteredTaskOptions.length ? <Text style={styles.emptyText}>No matching tasks.</Text> : null}
                  </View>
                </>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  }

  function closeTask() {
    if (returnTo) {
      router.replace(returnTo as Href);
      return;
    }
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/(workspace)/tasks");
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={styles.loadingText}>Loading task…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!task || !data) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.notFoundTitle}>Task not found</Text>
          <Pressable accessibilityRole="button" onPress={closeTask} style={styles.backBtn}>
            <Text style={styles.backBtnText}>Go back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const accent = priorityAccent(task.priority);
  const keyLabel = task.key ?? task.id.slice(0, 8).toUpperCase();
  const blocked = data.dependencies.blockedBy.length;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.accent} />}
        showsVerticalScrollIndicator={false}
      >
        {/* ── NAV BAR ── */}
        <View style={styles.navBar}>
          <Pressable accessibilityRole="button" onPress={closeTask} style={styles.navBack}>
            <ArrowLeft color={colors.foreground} size={20} strokeWidth={2.8} />
          </Pressable>
          <View style={styles.navCenter}>
            <Text style={styles.navProject} numberOfLines={1}>{task.project?.name ?? "Task"}</Text>
            <Text style={styles.navKey}>{keyLabel}</Text>
          </View>
          {saving ? (
            <View style={styles.savingDot}>
              <ActivityIndicator color={colors.accent} size="small" />
            </View>
          ) : (
            <View style={styles.navSpacer} />
          )}
        </View>

        {/* ── ERROR ── */}
        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* ── HERO CARD ── */}
        <View style={[styles.heroCard, { borderTopColor: accent }]}>
          <View style={styles.heroPills}>
            <StatusPill label={humanStatus(task.status)} tone={statusTone(task.status)} />
            <StatusPill label={humanStatus(task.type)} tone="neutral" />
          </View>
          <Text style={styles.heroTitle}>{task.title}</Text>
          <View style={styles.heroMeta}>
            <View style={[styles.heroDot, { backgroundColor: accent }]} />
            <Text style={[styles.heroMetaText, { color: accent }]}>{humanPriority(task.priority)}</Text>
            <View style={styles.heroBullet} />
            <CalendarDays color={colors.inkSoft} size={13} strokeWidth={2.5} />
            <Text style={styles.heroMetaText}>Due {formatCompactDate(task.dueDate)}</Text>
            {task.sprint?.name ? (
              <>
                <View style={styles.heroBullet} />
                <Text style={styles.heroMetaText}>{task.sprint.name}</Text>
              </>
            ) : null}
          </View>
        </View>

        {/* ── WORKFLOW ── */}
        <View style={styles.workflowCard}>
          <ControlRail
            active={task.status}
            getLabel={humanStatus}
            onChange={(status) => void quickUpdate({ status })}
            options={taskStatuses}
            title="Move to"
          />
          <View style={styles.cardDivider} />
          <ControlRail
            active={task.priority}
            getLabel={humanPriority}
            onChange={(priority) => void quickUpdate({ priority })}
            options={taskPriorities}
            title="Priority"
          />
        </View>

        {/* ── SIGNALS GRID ── */}
        <View style={styles.signalsGrid}>
          <SignalCard
            icon={<CheckSquare2 color={colors.success} size={20} strokeWidth={2.5} />}
            label="Checklist"
            tint={colors.greenSoft}
            value={`${checklistTotals.done}/${checklistTotals.total}`}
          />
          <SignalCard
            icon={<MessageSquare color={colors.accent} size={20} strokeWidth={2.5} />}
            label="Comments"
            tint={colors.blueSoft}
            value={String(data.comments.length)}
          />
          <SignalCard
            icon={<Paperclip color={colors.warning} size={20} strokeWidth={2.5} />}
            label="Files"
            tint={colors.orangeSoft}
            value={String(data.attachments.length)}
          />
          <SignalCard
            icon={<ShieldAlert color={blocked ? colors.danger : colors.inkSoft} size={20} strokeWidth={2.5} />}
            label="Blocked"
            tint={blocked ? colors.redSoft : colors.panelMuted}
            value={String(blocked)}
          />
        </View>

        {/* ── DETAILS ── */}
        <View style={styles.detailsCard}>
          <Text style={styles.detailsHeading}>Details</Text>
          <DetailRow label="Assignee" value={data.assignees.length ? data.assignees.map((a) => displayUserName(a.user)).join(", ") : "Unassigned"} />
          <DetailRow label="Project" value={task.project?.name ?? "No project"} />
          <DetailRow label="Sprint" value={task.sprint?.name ?? "Backlog"} />
          <DetailRow label="Story pts" value={String(task.storyPoints ?? 0)} />
          <DetailRow label="Estimate" value={task.estimateMins ? `${Math.round(task.estimateMins / 60)}h` : "Not set"} />
          <DetailRow label="Watchers" value={data.watchers.length ? String(data.watchers.length) : "None"} />
          <DetailRow label="Updated" value={formatShortDate(task.updatedAt)} last />
        </View>

        {/* ── DESCRIPTION ── */}
        <ContentCard icon={<FileText color={colors.accent} size={17} strokeWidth={2.5} />} title="Description">
          <Text style={task.description?.trim() ? styles.descriptionText : styles.emptyText}>
            {task.description?.trim() || "No description added yet."}
          </Text>
        </ContentCard>

        {/* ── LABELS ── */}
        {false && data!.labels.length > 0 && (
          <ContentCard icon={<Tag color={colors.accent} size={17} strokeWidth={2.5} />} title="Labels">
            <View style={styles.tagsRow}>
              {data!.labels.map((a) => (
                <View key={a.id} style={styles.tag}>
                  <Text style={styles.tagText}>{a.label.name}</Text>
                </View>
              ))}
            </View>
          </ContentCard>
        )}

        {/* ── CHECKLISTS ── */}
        {false && data!.checklists.length > 0 && (
          <ContentCard icon={<CheckCircle2 color={colors.accent} size={17} strokeWidth={2.5} />} title="Checklists">
            <View style={styles.checklistStack}>
              {data!.checklists.map((cl) => {
                const doneCount = cl.items.filter((i) => i.isDone).length;
                const totalCount = cl.items.length;
                return (
                  <View key={cl.id} style={styles.checklistGroup}>
                    <View style={styles.checklistGroupHeader}>
                      <Text style={styles.checklistGroupTitle}>{cl.title}</Text>
                      <Text style={styles.checklistGroupCount}>{doneCount}/{totalCount}</Text>
                    </View>
                    <View style={styles.checklistBar}>
                      <View style={{ flex: doneCount, height: 3, backgroundColor: colors.success, borderRadius: 99 }} />
                      <View style={{ flex: totalCount - doneCount, height: 3 }} />
                    </View>
                    {cl.items.map((item) => (
                      <View key={item.id} style={styles.checkItem}>
                        <View style={[styles.checkBox, item.isDone && styles.checkBoxDone]}>
                          {item.isDone && <Text style={styles.checkMark}>✓</Text>}
                        </View>
                        <Text style={[styles.checkItemText, item.isDone && styles.checkItemStrike]}>
                          {item.text}
                        </Text>
                      </View>
                    ))}
                  </View>
                );
              })}
            </View>
          </ContentCard>
        )}

        {/* ── DEPENDENCIES ── */}
        {false && (data!.dependencies.blockedBy.length > 0 || data!.dependencies.blocking.length > 0) && (
          <ContentCard icon={<Link2 color={colors.accent} size={17} strokeWidth={2.5} />} title="Dependencies">
            <DependencyGroup title="Blocked by" tasks={data!.dependencies.blockedBy.map((d) => d.fromTask).filter(isDependencyTask)} />
            <DependencyGroup title="Blocking" tasks={data!.dependencies.blocking.map((d) => d.toTask).filter(isDependencyTask)} />
          </ContentCard>
        )}

        {/* ── COMMENTS ── */}
        <ContentCard
          action={<SectionAction label="Add" onPress={() => openAction("addAssignee")} />}
          icon={<Users color={colors.accent} size={17} strokeWidth={2.5} />}
          title="Assignees"
          count={data.assignees.length}
        >
          {data.assignees.length ? (
            <View style={styles.personStack}>
              {data.assignees.map((assignee) => (
                <PersonRow
                  key={assignee.id}
                  meta={assignee.user.email}
                  name={displayUserName(assignee.user)}
                  onRemove={() => void runMutation(
                    () => removeTaskAssignee(accessToken!, task.id, assignee.user.id),
                    "Unable to remove assignee.",
                  )}
                />
              ))}
            </View>
          ) : (
            <EmptyPanel text="No assignee yet. Add an owner so the task has a clear driver." />
          )}
        </ContentCard>

        <ContentCard
          action={<SectionAction label="Add" onPress={() => openAction("addWatcher")} />}
          icon={<Eye color={colors.accent} size={17} strokeWidth={2.5} />}
          title="Watchers"
          count={data.watchers.length}
        >
          {data.watchers.length ? (
            <View style={styles.personStack}>
              {data.watchers.map((watcher) => (
                <PersonRow
                  key={watcher.id}
                  meta={watcher.user?.email ?? "Watching this task"}
                  name={displayUserName(watcher.user)}
                  onRemove={() => watcher.userId || watcher.user?.id ? void runMutation(
                    () => removeTaskWatcher(accessToken!, task.id, watcher.userId ?? watcher.user!.id),
                    "Unable to remove watcher.",
                  ) : undefined}
                />
              ))}
            </View>
          ) : (
            <EmptyPanel text="No watchers yet. Add teammates who need task updates." />
          )}
        </ContentCard>

        <ContentCard
          action={<SectionAction label="Add" onPress={() => openAction("addLabel")} />}
          icon={<Tag color={colors.accent} size={17} strokeWidth={2.5} />}
          title="Labels"
          count={data.labels.length}
        >
          {data.labels.length ? (
            <View style={styles.tagsRow}>
              {data.labels.map((assignment) => (
                <Pressable
                  accessibilityRole="button"
                  key={assignment.id}
                  onPress={() => void runMutation(
                    () => removeTaskLabel(accessToken!, task.id, assignment.label.id),
                    "Unable to remove label.",
                  )}
                  style={[styles.tag, { borderColor: assignment.label.color ?? "#e6c800" }]}
                >
                  <Text style={styles.tagText}>{assignment.label.name}</Text>
                  <X color="#7a5800" size={13} strokeWidth={3} />
                </Pressable>
              ))}
            </View>
          ) : (
            <EmptyPanel text="No labels yet. Add labels for filtering and reporting." />
          )}
        </ContentCard>

        <ContentCard
          action={<SectionAction label="New" onPress={() => openAction("addChecklist")} />}
          icon={<CheckCircle2 color={colors.accent} size={17} strokeWidth={2.5} />}
          title="Checklists"
          count={data.checklists.length}
        >
          {data.checklists.length ? (
            <View style={styles.checklistStack}>
              {data.checklists.map((cl) => {
                const doneCount = cl.items.filter((i) => i.isDone).length;
                const totalCount = cl.items.length;
                return (
                  <View key={cl.id} style={styles.checklistGroup}>
                    <View style={styles.checklistGroupHeader}>
                      <View style={styles.checklistTitleBlock}>
                        <Text style={styles.checklistGroupTitle}>{cl.title}</Text>
                        <Text style={styles.checklistGroupCount}>{doneCount}/{totalCount} complete</Text>
                      </View>
                      <View style={styles.rowActions}>
                        <Pressable accessibilityRole="button" onPress={() => openAction("addChecklistItem", cl.id)} style={styles.tinyAction}>
                          <Plus color={colors.foreground} size={15} strokeWidth={3} />
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => confirmDelete(
                            "Delete checklist",
                            `Delete "${cl.title}" and its items?`,
                            () => void runMutation(() => deleteTaskChecklist(accessToken!, task.id, cl.id), "Unable to delete checklist."),
                          )}
                          style={styles.tinyDangerAction}
                        >
                          <Trash2 color={colors.danger} size={15} strokeWidth={2.6} />
                        </Pressable>
                      </View>
                    </View>
                    <View style={styles.checklistBar}>
                      <View style={{ flex: doneCount || 0.01, height: 3, backgroundColor: colors.success, borderRadius: 99 }} />
                      <View style={{ flex: Math.max(totalCount - doneCount, 0) || 0.01, height: 3 }} />
                    </View>
                    {cl.items.length ? cl.items.map((item) => (
                      <View key={item.id} style={styles.checkItem}>
                        <Pressable
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: item.isDone }}
                          onPress={() => void runMutation(
                            () => updateTaskChecklistItem(accessToken!, task.id, cl.id, item.id, { isDone: !item.isDone }),
                            "Unable to update checklist item.",
                          )}
                          style={[styles.checkBox, item.isDone && styles.checkBoxDone]}
                        >
                          {item.isDone && <Text style={styles.checkMark}>✓</Text>}
                        </Pressable>
                        <Text style={[styles.checkItemText, item.isDone && styles.checkItemStrike]}>{item.text}</Text>
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => void runMutation(
                            () => deleteTaskChecklistItem(accessToken!, task.id, cl.id, item.id),
                            "Unable to delete checklist item.",
                          )}
                          style={styles.inlineTrash}
                        >
                          <Trash2 color={colors.inkSoft} size={15} strokeWidth={2.4} />
                        </Pressable>
                      </View>
                    )) : (
                      <Text style={styles.emptyText}>No checklist items yet.</Text>
                    )}
                  </View>
                );
              })}
            </View>
          ) : (
            <EmptyPanel text="No checklists yet. Create one to track acceptance items." />
          )}
        </ContentCard>

        <ContentCard
          action={<SectionAction label="Add" onPress={() => openAction("addDependency")} />}
          icon={<Link2 color={colors.accent} size={17} strokeWidth={2.5} />}
          title="Dependencies and blockers"
          count={data.dependencies.blockedBy.length + data.dependencies.blocking.length}
        >
          {data.dependencies.blockedBy.length || data.dependencies.blocking.length ? (
            <>
              <DependencyGroupManaged
                dependencies={data.dependencies.blockedBy}
                direction="from"
                onDelete={(dependencyId) => void runMutation(
                  () => deleteTaskDependency(accessToken!, task.id, dependencyId),
                  "Unable to remove dependency.",
                )}
                title="Blocked by"
              />
              <DependencyGroupManaged
                dependencies={data.dependencies.blocking}
                direction="to"
                onDelete={(dependencyId) => void runMutation(
                  () => deleteTaskDependency(accessToken!, task.id, dependencyId),
                  "Unable to remove dependency.",
                )}
                title="Blocking"
              />
            </>
          ) : (
            <EmptyPanel text="No dependencies or blockers recorded." />
          )}
        </ContentCard>

        <ContentCard
          action={<SectionAction label="Link" onPress={() => openAction("addAttachment")} />}
          icon={<Paperclip color={colors.accent} size={17} strokeWidth={2.5} />}
          title="Task files"
          count={data.attachments.length}
        >
          {data.attachments.length ? (
            <View style={styles.fileStack}>
              {data.attachments.map((file) => (
                <View key={file.id} style={styles.fileRow}>
                  <View style={styles.fileIcon}>
                    <Paperclip color={colors.accent} size={16} strokeWidth={2.6} />
                  </View>
                  <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(file.fileUrl)} style={styles.fileInfo}>
                    <Text numberOfLines={1} style={styles.fileName}>{file.fileName}</Text>
                    <Text numberOfLines={1} style={styles.fileMeta}>{file.mimeType ?? "Linked file"} · {formatShortDate(file.createdAt)}</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => void runMutation(
                      () => deleteTaskAttachment(accessToken!, task.id, file.id),
                      "Unable to delete task file.",
                    )}
                    style={styles.inlineTrash}
                  >
                    <Trash2 color={colors.danger} size={16} strokeWidth={2.4} />
                  </Pressable>
                </View>
              ))}
            </View>
          ) : (
            <EmptyPanel text="No files yet. Link a document, image, or provider URL." />
          )}
        </ContentCard>

        <ContentCard
          icon={<MessageSquare color={colors.accent} size={17} strokeWidth={2.5} />}
          title="Comments"
          count={data.comments.length}
        >
          <View style={styles.composer}>
            <TextInput
              multiline
              onChangeText={setCommentDraft}
              placeholder="Write an update…"
              placeholderTextColor={colors.inkSoft}
              style={styles.composerInput}
              value={commentDraft}
            />
            <Pressable
              accessibilityRole="button"
              disabled={saving || !commentDraft.trim()}
              onPress={() => void submitComment()}
              style={[styles.composerSend, (!commentDraft.trim() || saving) && styles.composerSendDisabled]}
            >
              <Send color={colors.black} size={17} strokeWidth={2.8} />
            </Pressable>
          </View>
          {data.comments.length ? (
            <View style={styles.commentList}>
              {data.comments.slice(0, 6).map((comment) => {
                const name = displayUserName(comment.author);
                const initial = name.slice(0, 1).toUpperCase();
                return (
                  <View key={comment.id} style={styles.commentRow}>
                    <View style={styles.commentAvatar}>
                      <Text style={styles.commentAvatarText}>{initial}</Text>
                    </View>
                    <View style={styles.commentBubble}>
                      <View style={styles.commentBubbleHeader}>
                        <Text style={styles.commentAuthor}>{name}</Text>
                        <View style={styles.commentHeaderActions}>
                          <Text style={styles.commentDate}>{formatShortDate(comment.createdAt)}</Text>
                          <Pressable
                            accessibilityRole="button"
                            onPress={() => confirmDelete(
                              "Delete comment",
                              "Remove this task comment?",
                              () => void runMutation(
                                () => deleteTaskComment(accessToken!, task.id, comment.id),
                                "Unable to delete comment.",
                              ),
                            )}
                            style={styles.commentDelete}
                          >
                            <Trash2 color={colors.inkSoft} size={14} strokeWidth={2.4} />
                          </Pressable>
                        </View>
                      </View>
                      <Text style={styles.commentBody}>{comment.body}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <Text style={styles.emptyText}>No comments yet. Start the conversation.</Text>
          )}
        </ContentCard>

        {/* ── ACTIVITY ── */}
        <ContentCard icon={<Archive color={colors.accent} size={17} strokeWidth={2.5} />} title="Task controls">
          <View style={styles.controlStack}>
            <Pressable accessibilityRole="button" onPress={() => openAction("editTask")} style={styles.controlButton}>
              <FileText color={colors.foreground} size={17} strokeWidth={2.6} />
              <Text style={styles.controlButtonText}>Edit task details</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={task.deletedAt ? () => void runMutation(() => restoreTask(accessToken!, task.id), "Unable to restore task.") : confirmArchive}
              style={styles.controlButton}
            >
              {task.deletedAt ? <RotateCcw color={colors.foreground} size={17} strokeWidth={2.6} /> : <Archive color={colors.foreground} size={17} strokeWidth={2.6} />}
              <Text style={styles.controlButtonText}>{task.deletedAt ? "Restore task" : "Archive task"}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={confirmDeleteTask} style={[styles.controlButton, styles.controlDanger]}>
              <Trash2 color={colors.danger} size={17} strokeWidth={2.6} />
              <Text style={styles.controlDangerText}>Delete task</Text>
            </Pressable>
          </View>
        </ContentCard>

        <ContentCard icon={<CalendarDays color={colors.accent} size={17} strokeWidth={2.5} />} title="Activity">
          {data.activities.length ? (
            <View style={styles.timeline}>
              {data.activities.slice(0, 8).map((activity, idx) => {
                const isLast = idx === Math.min(data.activities.length, 8) - 1;
                return (
                  <View key={activity.id} style={styles.timelineRow}>
                    <View style={styles.timelineLeft}>
                      <View style={styles.timelineDot} />
                      {!isLast && <View style={styles.timelineLine} />}
                    </View>
                    <View style={styles.timelineBody}>
                      <Text style={styles.timelineAction}>{humanStatus(activity.action)}</Text>
                      <Text style={styles.timelineDate}>{formatShortDate(activity.createdAt)}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <Text style={styles.emptyText}>No activity yet.</Text>
          )}
        </ContentCard>
      </ScrollView>
      {renderActionModal()}
    </SafeAreaView>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function safe<T>(promise: Promise<T>, fallback: T): Promise<T> {
  try { return await promise; }
  catch { return fallback; }
}

function isDependencyTask(
  t: TaskDependency["fromTask"] | TaskDependency["toTask"] | undefined,
): t is NonNullable<TaskDependency["fromTask"]> {
  return Boolean(t);
}

function priorityAccent(priority: string): string {
  if (priority === "CRITICAL") return colors.danger;
  if (priority === "URGENT") return colors.warning;
  if (priority === "HIGH") return "#b45309";
  if (priority === "MEDIUM") return colors.accent;
  return colors.inkSoft;
}

function initials(user: TenantUser) {
  const name = displayUserName(user);
  return name.split(/\s+/).slice(0, 2).map((part) => part.charAt(0)).join("").toUpperCase() || "U";
}

function actionTitle(action: Exclude<TaskAction, null>) {
  const titles: Record<Exclude<TaskAction, null>, string> = {
    addAssignee: "Add assignee",
    addAttachment: "Link task file",
    addChecklist: "Create checklist",
    addChecklistItem: "Add checklist item",
    addDependency: "Add dependency",
    addLabel: "Add label",
    addWatcher: "Add watcher",
    createLabel: "Create label",
    editTask: "Edit task",
  };
  return titles[action];
}

function actionSubtitle(action: Exclude<TaskAction, null>) {
  const subtitles: Record<Exclude<TaskAction, null>, string> = {
    addAssignee: "Assign an accountable owner for this task.",
    addAttachment: "Register a Cloudinary, S3, document, or provider link.",
    addChecklist: "Track acceptance work without leaving the task.",
    addChecklistItem: "Add the next small, verifiable step.",
    addDependency: "Connect this work to a blocker or related task.",
    addLabel: "Classify the task for filtering and reporting.",
    addWatcher: "Notify teammates who need progress updates.",
    createLabel: "Create a reusable workspace label and add it here.",
    editTask: "Update the task identity, classification, schedule, and effort.",
  };
  return subtitles[action];
}

// ── Sub-components ───────────────────────────────────────────────────────────

function ContentCard({
  action,
  children,
  count,
  icon,
  title,
}: {
  action?: ReactNode;
  children: ReactNode;
  count?: number;
  icon: ReactNode;
  title: string;
}) {
  return (
    <View style={styles.contentCard}>
      <View style={styles.cardHeader}>
        {icon}
        <Text style={styles.cardTitle}>{title}</Text>
        {count !== undefined && count > 0 && (
          <View style={styles.cardBadge}>
            <Text style={styles.cardBadgeText}>{count}</Text>
          </View>
        )}
        {action}
      </View>
      {children}
    </View>
  );
}

function ControlRail<T extends string>({
  active,
  getLabel,
  onChange,
  options,
  title,
}: {
  active: T;
  getLabel: (v: T) => string;
  onChange: (v: T) => void;
  options: readonly T[];
  title: string;
}) {
  return (
    <View style={styles.railBlock}>
      <Text style={styles.railLabel}>{title}</Text>
      <ScrollView contentContainerStyle={styles.railChips} horizontal showsHorizontalScrollIndicator={false}>
        {options.map((opt) => (
          <Pressable
            accessibilityRole="button"
            key={opt}
            onPress={() => onChange(opt)}
            style={[styles.chip, active === opt && styles.chipActive]}
          >
            <Text style={[styles.chipText, active === opt && styles.chipTextActive]}>{getLabel(opt)}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function SignalCard({ icon, label, tint, value }: { icon: ReactNode; label: string; tint: string; value: string }) {
  return (
    <View style={[styles.signalCard, { backgroundColor: tint }]}>
      {icon}
      <Text style={styles.signalValue}>{value}</Text>
      <Text style={styles.signalLabel}>{label}</Text>
    </View>
  );
}

function DetailRow({ label, last, value }: { label: string; last?: boolean; value: string }) {
  return (
    <View style={[styles.detailRow, !last && styles.detailRowBorder]}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text numberOfLines={2} style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function SectionAction({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.sectionAction}>
      <Plus color={colors.black} size={14} strokeWidth={3} />
      <Text style={styles.sectionActionText}>{label}</Text>
    </Pressable>
  );
}

function EmptyPanel({ text }: { text: string }) {
  return (
    <View style={styles.emptyPanel}>
      <Text style={styles.emptyPanelText}>{text}</Text>
    </View>
  );
}

function PersonRow({ meta, name, onRemove }: { meta?: string | null; name: string; onRemove?: () => void }) {
  return (
    <View style={styles.personRow}>
      <View style={styles.personAvatar}>
        <Text style={styles.personAvatarText}>{name.slice(0, 1).toUpperCase() || "U"}</Text>
      </View>
      <View style={styles.personTextBlock}>
        <Text numberOfLines={1} style={styles.personName}>{name}</Text>
        <Text numberOfLines={1} style={styles.personMeta}>{meta ?? "Team member"}</Text>
      </View>
      {onRemove ? (
        <Pressable accessibilityRole="button" onPress={onRemove} style={styles.inlineTrash}>
          <X color={colors.inkSoft} size={16} strokeWidth={3} />
        </Pressable>
      ) : null}
    </View>
  );
}

function ManagedInput({
  label,
  onChangeText,
  placeholder,
  value,
}: {
  label: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  return (
    <View style={styles.managedInputBlock}>
      <Text style={styles.managedInputLabel}>{label}</Text>
      <TextInput
        autoCapitalize="none"
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.inkSoft}
        style={styles.managedInput}
        value={value}
      />
    </View>
  );
}

function PrimaryModalButton({ disabled, label, onPress }: { disabled?: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[styles.primaryModalButton, disabled && styles.primaryModalButtonDisabled]}>
      <Text style={styles.primaryModalButtonText}>{label}</Text>
    </Pressable>
  );
}

function DependencyGroup({ tasks, title }: { tasks: NonNullable<TaskDependency["fromTask"]>[]; title: string }) {
  if (!tasks.length) return null;
  return (
    <View style={styles.depGroup}>
      <Text style={styles.depGroupTitle}>{title}</Text>
      {tasks.map((t) => (
        <View key={t.id} style={styles.depRow}>
          <View style={styles.depDot} />
          <Text numberOfLines={1} style={styles.depText}>{t.key} · {t.title}</Text>
          <StatusPill label={humanStatus(t.status)} tone={statusTone(t.status)} />
        </View>
      ))}
    </View>
  );
}

function DependencyGroupManaged({
  dependencies,
  direction,
  onDelete,
  title,
}: {
  dependencies: TaskDependency[];
  direction: "from" | "to";
  onDelete: (dependencyId: string) => void;
  title: string;
}) {
  if (!dependencies.length) return null;
  return (
    <View style={styles.depGroup}>
      <Text style={styles.depGroupTitle}>{title}</Text>
      {dependencies.map((dependency) => {
        const linkedTask = direction === "from" ? dependency.fromTask : dependency.toTask;
        if (!isDependencyTask(linkedTask)) return null;
        return (
          <View key={dependency.id} style={styles.depRow}>
            <View style={styles.depDot} />
            <Text numberOfLines={1} style={styles.depText}>{linkedTask.key} · {linkedTask.title}</Text>
            <StatusPill label={humanStatus(linkedTask.status)} tone={statusTone(linkedTask.status)} />
            <Pressable accessibilityRole="button" onPress={() => onDelete(dependency.id)} style={styles.depDelete}>
              <X color={colors.inkSoft} size={14} strokeWidth={3} />
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create(withFontStyles({
  safe: { backgroundColor: colors.background, flex: 1 },
  content: { gap: 16, paddingBottom: 120, paddingHorizontal: 20, paddingTop: 12 },

  // Loading / empty states
  center: { alignItems: "center", flex: 1, gap: 14, justifyContent: "center", padding: 32 },
  loadingText: { color: colors.inkSoft, fontSize: 14, fontWeight: "700" },
  notFoundTitle: { color: colors.foreground, fontSize: 20, fontWeight: "900" },
  backBtn: {
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  backBtnText: { color: colors.black, fontSize: 14, fontWeight: "900" },

  // Nav bar
  navBar: { alignItems: "center", flexDirection: "row", gap: 12 },
  navBack: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: radii.lg,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    width: 44,
    ...shadow.card,
  },
  navCenter: { flex: 1, minWidth: 0 },
  navProject: { color: colors.inkSoft, fontSize: 12, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 },
  navKey: { color: colors.foreground, fontSize: 16, fontWeight: "900", marginTop: 1 },
  savingDot: {
    alignItems: "center",
    backgroundColor: colors.blueSoft,
    borderRadius: radii.lg,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  navSpacer: { width: 38 },

  // Error
  errorBox: {
    backgroundColor: colors.redSoft,
    borderColor: "#fecaca",
    borderRadius: radii.xl,
    borderWidth: 1,
    padding: 14,
  },
  errorText: { color: colors.danger, fontSize: 13, fontWeight: "800", lineHeight: 18 },

  // Hero card
  heroCard: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: radii.xl,
    borderTopWidth: 4,
    borderWidth: 1,
    gap: 12,
    padding: 20,
    ...shadow.card,
  },
  heroPills: { flexDirection: "row", gap: 8 },
  heroTitle: {
    color: colors.foreground,
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: -0.4,
    lineHeight: 30,
  },
  heroMeta: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 6 },
  heroDot: { borderRadius: 99, height: 7, width: 7 },
  heroBullet: { backgroundColor: colors.line, borderRadius: 99, height: 4, width: 4 },
  heroMetaText: { color: colors.inkSoft, fontSize: 13, fontWeight: "700" },

  // Workflow card
  workflowCard: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: radii.xl,
    borderWidth: 1,
    gap: 16,
    padding: 18,
    ...shadow.card,
  },
  cardDivider: { backgroundColor: colors.line, height: 1 },
  railBlock: { gap: 10 },
  railLabel: {
    color: colors.inkSoft,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.7,
    textTransform: "uppercase",
  },
  railChips: { gap: 8, paddingRight: 4 },
  chip: {
    backgroundColor: colors.panelMuted,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  chipActive: { backgroundColor: colors.foreground, borderColor: colors.foreground },
  chipText: { color: colors.inkSoft, fontSize: 13, fontWeight: "800" },
  chipTextActive: { color: colors.white },

  // Signals grid
  signalsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 12,
  },
  signalCard: {
    alignItems: "center",
    borderRadius: radii.xl,
    gap: 6,
    justifyContent: "center",
    minHeight: 164,
    paddingHorizontal: 12,
    paddingVertical: 18,
    width: "48%",
  },
  signalValue: { color: colors.foreground, fontSize: 22, fontWeight: "900", letterSpacing: -0.5 },
  signalLabel: {
    color: colors.inkSoft,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },

  // Details card
  detailsCard: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: radii.xl,
    borderWidth: 1,
    overflow: "hidden",
    ...shadow.card,
  },
  detailsHeading: {
    color: colors.inkSoft,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.7,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 4,
    textTransform: "uppercase",
  },
  detailRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    minHeight: 52,
    paddingHorizontal: 18,
  },
  detailRowBorder: { borderBottomColor: colors.line, borderBottomWidth: 1 },
  detailLabel: { color: colors.inkSoft, fontSize: 13, fontWeight: "700", width: 90 },
  detailValue: { color: colors.foreground, flex: 1, fontSize: 14, fontWeight: "800", textAlign: "right" },

  // Content cards
  contentCard: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: radii.xl,
    borderWidth: 1,
    gap: 14,
    padding: 18,
    ...shadow.card,
  },
  cardHeader: { alignItems: "center", flexDirection: "row", gap: 9 },
  cardTitle: { color: colors.foreground, flex: 1, fontSize: 16, fontWeight: "900" },
  cardBadge: {
    alignItems: "center",
    backgroundColor: colors.blueSoft,
    borderRadius: 99,
    minWidth: 26,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  cardBadgeText: { color: colors.accent, fontSize: 12, fontWeight: "900" },

  // Description
  descriptionText: { color: colors.foreground, fontSize: 15, fontWeight: "500", lineHeight: 23 },
  emptyText: { color: colors.inkSoft, fontSize: 13, fontWeight: "700" },

  // Labels
  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tag: {
    backgroundColor: colors.yellowSoft,
    borderColor: "#e6c800",
    borderRadius: 99,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  tagText: { color: "#7a5800", fontSize: 12, fontWeight: "900" },

  // Checklists
  checklistStack: { gap: 16 },
  checklistGroup: { gap: 10 },
  checklistGroupHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  checklistGroupTitle: { color: colors.foreground, fontSize: 14, fontWeight: "900" },
  checklistGroupCount: { color: colors.inkSoft, fontSize: 12, fontWeight: "800" },
  checklistBar: {
    backgroundColor: colors.line,
    borderRadius: 99,
    flexDirection: "row",
    height: 3,
    overflow: "hidden",
  },
  checkItem: { alignItems: "center", flexDirection: "row", gap: 12 },
  checkBox: {
    alignItems: "center",
    borderColor: colors.line,
    borderRadius: 6,
    borderWidth: 2,
    height: 20,
    justifyContent: "center",
    width: 20,
  },
  checkBoxDone: { backgroundColor: colors.success, borderColor: colors.success },
  checkMark: { color: colors.white, fontSize: 11, fontWeight: "900" },
  checkItemText: { color: colors.foreground, flex: 1, fontSize: 14, fontWeight: "700" },
  checkItemStrike: { color: colors.inkSoft, textDecorationLine: "line-through" },

  // Dependencies
  depGroup: { gap: 8 },
  depGroupTitle: {
    color: colors.inkSoft,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  depRow: {
    alignItems: "center",
    backgroundColor: colors.panelMuted,
    borderRadius: radii.lg,
    flexDirection: "row",
    gap: 10,
    minHeight: 46,
    paddingHorizontal: 14,
  },
  depDot: { backgroundColor: colors.accent, borderRadius: 99, height: 7, width: 7 },
  depText: { color: colors.foreground, flex: 1, fontSize: 13, fontWeight: "800" },

  // Comments
  composer: {
    alignItems: "flex-end",
    backgroundColor: colors.panelMuted,
    borderColor: colors.line,
    borderRadius: radii.xl,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    padding: 12,
  },
  composerInput: {
    color: colors.foreground,
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    minHeight: 60,
    textAlignVertical: "top",
  },
  composerSend: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  composerSendDisabled: { opacity: 0.4 },
  commentList: { gap: 14 },
  commentRow: { alignItems: "flex-start", flexDirection: "row", gap: 10 },
  commentAvatar: {
    alignItems: "center",
    backgroundColor: colors.foreground,
    borderRadius: 99,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  commentAvatarText: { color: colors.white, fontSize: 13, fontWeight: "900" },
  commentBubble: {
    backgroundColor: colors.panelMuted,
    borderRadius: radii.lg,
    flex: 1,
    gap: 6,
    padding: 12,
  },
  commentBubbleHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  commentAuthor: { color: colors.foreground, fontSize: 13, fontWeight: "900" },
  commentDate: { color: colors.inkSoft, fontSize: 11, fontWeight: "700" },
  commentBody: { color: colors.foreground, fontSize: 14, fontWeight: "500", lineHeight: 20 },

  // Activity timeline
  timeline: { gap: 0 },
  timelineRow: { flexDirection: "row", gap: 14, minHeight: 48 },
  timelineLeft: { alignItems: "center", width: 16 },
  timelineDot: {
    backgroundColor: colors.primary,
    borderColor: colors.background,
    borderRadius: 99,
    borderWidth: 2,
    height: 14,
    width: 14,
  },
  timelineLine: { backgroundColor: colors.line, flex: 1, marginTop: 2, width: 2 },
  timelineBody: { flex: 1, gap: 3, paddingBottom: 16, paddingTop: 1 },
  timelineAction: { color: colors.foreground, fontSize: 14, fontWeight: "800" },
  timelineDate: { color: colors.inkSoft, fontSize: 12, fontWeight: "700" },

  sectionAction: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 999,
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  sectionActionText: { color: colors.black, fontSize: 11, fontWeight: "900" },
  emptyPanel: {
    backgroundColor: colors.panelMuted,
    borderColor: colors.line,
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: 14,
  },
  emptyPanelText: { color: colors.inkSoft, fontSize: 13, fontWeight: "700", lineHeight: 19 },

  personStack: { gap: 10 },
  personRow: {
    alignItems: "center",
    backgroundColor: colors.panelMuted,
    borderRadius: radii.lg,
    flexDirection: "row",
    gap: 10,
    padding: 12,
  },
  personAvatar: {
    alignItems: "center",
    backgroundColor: colors.foreground,
    borderRadius: 999,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  personAvatarText: { color: colors.white, fontSize: 12, fontWeight: "900" },
  personTextBlock: { flex: 1, minWidth: 0 },
  personName: { color: colors.foreground, fontSize: 14, fontWeight: "900" },
  personMeta: { color: colors.inkSoft, fontSize: 12, fontWeight: "700", marginTop: 2 },

  checklistTitleBlock: { flex: 1, gap: 2, minWidth: 0 },
  rowActions: { alignItems: "center", flexDirection: "row", gap: 8 },
  tinyAction: {
    alignItems: "center",
    backgroundColor: colors.panelMuted,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    height: 30,
    justifyContent: "center",
    width: 30,
  },
  tinyDangerAction: {
    alignItems: "center",
    backgroundColor: colors.redSoft,
    borderColor: "#fecaca",
    borderRadius: 999,
    borderWidth: 1,
    height: 30,
    justifyContent: "center",
    width: 30,
  },
  inlineTrash: {
    alignItems: "center",
    borderRadius: 999,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  depDelete: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderRadius: 999,
    height: 28,
    justifyContent: "center",
    width: 28,
  },

  fileStack: { gap: 10 },
  fileRow: {
    alignItems: "center",
    backgroundColor: colors.panelMuted,
    borderRadius: radii.lg,
    flexDirection: "row",
    gap: 10,
    padding: 12,
  },
  fileIcon: {
    alignItems: "center",
    backgroundColor: colors.blueSoft,
    borderRadius: radii.md,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  fileInfo: { flex: 1, minWidth: 0 },
  fileName: { color: colors.foreground, fontSize: 14, fontWeight: "900" },
  fileMeta: { color: colors.inkSoft, fontSize: 12, fontWeight: "700", marginTop: 2 },

  commentHeaderActions: { alignItems: "center", flexDirection: "row", gap: 8 },
  commentDelete: {
    alignItems: "center",
    borderRadius: 999,
    height: 24,
    justifyContent: "center",
    width: 24,
  },

  controlStack: { gap: 10 },
  controlButton: {
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
  controlButtonText: { color: colors.foreground, fontSize: 14, fontWeight: "900" },
  controlDanger: { backgroundColor: colors.redSoft, borderColor: "#fecaca" },
  controlDangerText: { color: colors.danger, fontSize: 14, fontWeight: "900" },

  modalBackdrop: {
    backgroundColor: "rgba(12, 12, 12, 0.36)",
    flex: 1,
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: "88%",
    paddingBottom: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  modalHandle: {
    alignSelf: "center",
    backgroundColor: colors.line,
    borderRadius: 999,
    height: 4,
    marginBottom: 16,
    width: 44,
  },
  modalHeader: { alignItems: "flex-start", flexDirection: "row", gap: 12, justifyContent: "space-between" },
  modalEyebrow: { color: colors.accent, fontSize: 11, fontWeight: "900", letterSpacing: 0.8, textTransform: "uppercase" },
  modalTitle: { color: colors.foreground, fontSize: 24, fontWeight: "900", letterSpacing: -0.3, marginTop: 2 },
  modalSubtitle: { color: colors.inkSoft, fontSize: 13, fontWeight: "700", lineHeight: 19, marginTop: 3, maxWidth: 280 },
  modalClose: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  modalBody: { gap: 14, paddingBottom: 20, paddingTop: 18 },
  managedInputBlock: { gap: 8 },
  managedInputLabel: { color: colors.foreground, fontSize: 13, fontWeight: "900" },
  managedInput: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: radii.xl,
    borderWidth: 1,
    color: colors.foreground,
    fontSize: 15,
    fontWeight: "800",
    minHeight: 52,
    paddingHorizontal: 16,
  },
  managedTextArea: { minHeight: 118, paddingTop: 14, textAlignVertical: "top" },
  modalTwoCol: { flexDirection: "row", gap: 12 },
  primaryModalButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radii.xl,
    minHeight: 54,
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  primaryModalButtonDisabled: { opacity: 0.45 },
  primaryModalButtonText: { color: colors.black, fontSize: 15, fontWeight: "900" },
  optionStack: { gap: 9 },
  optionRow: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: 58,
    paddingHorizontal: 12,
  },
  optionRowDisabled: { opacity: 0.55 },
  optionAvatar: {
    alignItems: "center",
    backgroundColor: colors.foreground,
    borderRadius: 999,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  optionAvatarText: { color: colors.white, fontSize: 12, fontWeight: "900" },
  optionTextBlock: { flex: 1, minWidth: 0 },
  optionTitle: { color: colors.foreground, flex: 1, fontSize: 14, fontWeight: "900" },
  optionMeta: { color: colors.inkSoft, fontSize: 12, fontWeight: "700", marginTop: 2 },
  optionAddText: { color: colors.accent, fontSize: 12, fontWeight: "900" },
  optionSelectedText: { color: colors.inkSoft, fontSize: 12, fontWeight: "900" },
  createInline: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: colors.primary,
    borderRadius: 999,
    flexDirection: "row",
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  createInlineText: { color: colors.black, fontSize: 13, fontWeight: "900" },
  labelSwatch: { borderRadius: 999, height: 16, width: 16 },
  optionTaskKey: {
    alignItems: "center",
    backgroundColor: colors.blueSoft,
    borderRadius: radii.md,
    minWidth: 48,
    paddingHorizontal: 8,
    paddingVertical: 7,
  },
  optionTaskKeyText: { color: colors.accent, fontSize: 11, fontWeight: "900" },
  typeRail: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  typeChip: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  typeChipActive: { backgroundColor: colors.foreground, borderColor: colors.foreground },
  typeChipText: { color: colors.inkSoft, fontSize: 12, fontWeight: "900" },
  typeChipTextActive: { color: colors.white },
}));
