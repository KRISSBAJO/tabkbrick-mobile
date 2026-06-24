import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, type Href } from "expo-router";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  CheckSquare2,
  FileText,
  Link2,
  MessageSquare,
  Paperclip,
  Send,
  ShieldAlert,
  Tag,
} from "lucide-react-native";
import { StatusPill } from "@/components/ui/StatusPill";
import {
  createTaskComment,
  getTask,
  listTaskActivities,
  listTaskAssignees,
  listTaskAttachments,
  listTaskChecklists,
  listTaskComments,
  listTaskDependencies,
  listTaskLabels,
  listTaskWatchers,
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
  TaskLabelAssignment,
  TaskWatcher,
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
} from "./taskFilters";

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
        {data.labels.length > 0 && (
          <ContentCard icon={<Tag color={colors.accent} size={17} strokeWidth={2.5} />} title="Labels">
            <View style={styles.tagsRow}>
              {data.labels.map((a) => (
                <View key={a.id} style={styles.tag}>
                  <Text style={styles.tagText}>{a.label.name}</Text>
                </View>
              ))}
            </View>
          </ContentCard>
        )}

        {/* ── CHECKLISTS ── */}
        {data.checklists.length > 0 && (
          <ContentCard icon={<CheckCircle2 color={colors.accent} size={17} strokeWidth={2.5} />} title="Checklists">
            <View style={styles.checklistStack}>
              {data.checklists.map((cl) => {
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
        {(data.dependencies.blockedBy.length > 0 || data.dependencies.blocking.length > 0) && (
          <ContentCard icon={<Link2 color={colors.accent} size={17} strokeWidth={2.5} />} title="Dependencies">
            <DependencyGroup title="Blocked by" tasks={data.dependencies.blockedBy.map((d) => d.fromTask).filter(isDependencyTask)} />
            <DependencyGroup title="Blocking" tasks={data.dependencies.blocking.map((d) => d.toTask).filter(isDependencyTask)} />
          </ContentCard>
        )}

        {/* ── COMMENTS ── */}
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
                        <Text style={styles.commentDate}>{formatShortDate(comment.createdAt)}</Text>
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

// ── Sub-components ───────────────────────────────────────────────────────────

function ContentCard({
  children,
  count,
  icon,
  title,
}: {
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
}));
