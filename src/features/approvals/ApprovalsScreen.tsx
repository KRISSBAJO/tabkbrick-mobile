import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
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
import { router } from "expo-router";
import {
  Archive,
  ArrowLeft,
  Ban,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  X,
  XCircle,
} from "lucide-react-native";
import {
  approveApprovalStep,
  archiveApprovalDefinition,
  cancelApproval,
  createApproval,
  createApprovalDefinition,
  listApprovalDefinitions,
  listApprovals,
  listMyPendingApprovals,
  listUsers,
  rejectApprovalStep,
  reopenApproval,
  restoreApprovalDefinition,
  updateApprovalDefinition,
  type Approval,
  type ApprovalDefinition,
  type ApprovalStatus,
  type ApprovalStep,
  type ApprovalStepInput,
} from "@/lib/api";
import { useAuthSession } from "@/lib/auth/AuthSessionProvider";
import { withFontStyles } from "@/lib/theme/fontDefaults";
import { colors, radii, shadow } from "@/lib/theme/tokens";
import type { TenantUser } from "@/lib/types";

type ActiveTab = "pending" | "all" | "definitions";
type DecisionMode = "approve" | "reject";
type SheetMode = "approval" | "definition" | null;
type DraftStep = {
  approverId: string;
  approverRole: string;
  escalationHours: string;
  required: boolean;
  title: string;
};
type ApprovalForm = {
  definitionId: string;
  description: string;
  dueDate: string;
  entityId: string;
  entityType: string;
  stepApproverId: string;
  stepApproverRole: string;
  stepTitle: string;
  title: string;
};
type DefinitionForm = {
  id?: string;
  description: string;
  entityType: string;
  isActive: boolean;
  name: string;
  steps: DraftStep[];
};

const statuses: ApprovalStatus[] = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"];
const entityTypes = ["PROJECT", "TASK", "DOCUMENT", "SPRINT", "MEETING", "RISK", "BUDGET", "CHANGE_REQUEST", "GENERAL"];

export function ApprovalsScreen() {
  const { accessToken, user } = useAuthSession();
  const [activeTab, setActiveTab] = useState<ActiveTab>("pending");
  const [allApprovals, setAllApprovals] = useState<Approval[]>([]);
  const [approvalForm, setApprovalForm] = useState<ApprovalForm>(() => emptyApprovalForm());
  const [definitionForm, setDefinitionForm] = useState<DefinitionForm>(() => emptyDefinitionForm());
  const [definitions, setDefinitions] = useState<ApprovalDefinition[]>([]);
  const [decision, setDecision] = useState<{ approval: Approval; mode: DecisionMode; step: ApprovalStep } | null>(null);
  const [decisionComment, setDecisionComment] = useState("");
  const [detail, setDetail] = useState<Approval | null>(null);
  const [error, setError] = useState("");
  const [filterStatus, setFilterStatus] = useState<ApprovalStatus | "ALL">("ALL");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pendingApprovals, setPendingApprovals] = useState<Approval[]>([]);
  const [query, setQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sheet, setSheet] = useState<SheetMode>(null);
  const [users, setUsers] = useState<TenantUser[]>([]);

  const canManage = Boolean(user?.permissions.includes("manage:projects") || user?.permissions.includes("manage:all"));
  const currentUserId = user?.id ?? "";
  const waitingForOthers = allApprovals.filter((approval) => approval.status === "PENDING" && !approval.steps.some((step) => isMyPendingStep(step, currentUserId))).length;
  const activeDefinitions = definitions.filter((definition) => definition.isActive && !definition.archivedAt).length;

  const visibleApprovals = useMemo(() => {
    const text = query.trim().toLowerCase();
    return allApprovals.filter((approval) => {
      if (filterStatus !== "ALL" && approval.status !== filterStatus) return false;
      if (!text) return true;
      return [approval.title, approval.description, approval.entityType, approval.entityId]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(text));
    });
  }, [allApprovals, filterStatus, query]);

  const load = useCallback(async (showRefresh = false) => {
    if (!accessToken) return;
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    setError("");
    setMessage(null);
    try {
      const [pendingPage, approvalPage, definitionPage, userPage] = await Promise.all([
        listMyPendingApprovals(accessToken, { limit: 100 }),
        listApprovals(accessToken, { limit: 100 }),
        listApprovalDefinitions(accessToken, { includeArchived: true, limit: 100 }),
        listUsers(accessToken, { limit: 100 }),
      ]);
      setPendingApprovals(pendingPage.data);
      setAllApprovals(approvalPage.data);
      setDefinitions(definitionPage.data);
      setUsers(Array.isArray(userPage) ? userPage : userPage.data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load approvals.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  function openRequestSheet() {
    setApprovalForm(emptyApprovalForm());
    setMessage(null);
    setSheet("approval");
  }

  function openDefinitionSheet(definition?: ApprovalDefinition) {
    setMessage(null);
    if (!definition) {
      setDefinitionForm(emptyDefinitionForm());
    } else {
      setDefinitionForm({
        id: definition.id,
        description: definition.description ?? "",
        entityType: definition.entityType,
        isActive: definition.isActive,
        name: definition.name,
        steps: definition.steps.map((step) => ({
          approverId: step.approverId ?? "",
          approverRole: step.approverRole ?? "",
          escalationHours: step.escalationHours ? String(step.escalationHours) : "",
          required: step.required,
          title: step.title,
        })),
      });
    }
    setSheet("definition");
  }

  async function submitApproval() {
    if (!accessToken || !approvalForm.title.trim() || !approvalForm.entityId.trim()) return;
    const steps = buildApprovalSteps(approvalForm);
    if (!approvalForm.definitionId && !steps.length) {
      setMessage({ ok: false, text: "Choose a definition or direct approver." });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const created = await createApproval(accessToken, {
        definitionId: approvalForm.definitionId || undefined,
        description: approvalForm.description.trim() || undefined,
        dueDate: approvalForm.dueDate ? new Date(`${approvalForm.dueDate}T12:00:00`).toISOString() : undefined,
        entityId: approvalForm.entityId.trim(),
        entityType: approvalForm.entityType,
        steps: approvalForm.definitionId ? undefined : steps,
        title: approvalForm.title.trim(),
      });
      setAllApprovals((current) => [created, ...current]);
      setSheet(null);
      setMessage({ ok: true, text: "Approval request created." });
      await load(true);
    } catch (caught) {
      setMessage({ ok: false, text: caught instanceof Error ? caught.message : "Unable to create approval." });
    } finally {
      setSaving(false);
    }
  }

  async function submitDefinition() {
    if (!accessToken || !definitionForm.name.trim()) return;
    const steps = buildDefinitionSteps(definitionForm.steps);
    if (!steps.length) {
      setMessage({ ok: false, text: "Add at least one resolvable approver step." });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const payload = {
        description: definitionForm.description.trim() || undefined,
        entityType: definitionForm.entityType,
        isActive: definitionForm.isActive,
        name: definitionForm.name.trim(),
        steps,
      };
      const saved = definitionForm.id
        ? await updateApprovalDefinition(accessToken, definitionForm.id, payload)
        : await createApprovalDefinition(accessToken, payload);
      setDefinitions((current) => [saved, ...current.filter((definition) => definition.id !== saved.id)]);
      setSheet(null);
      setMessage({ ok: true, text: definitionForm.id ? "Definition updated." : "Definition created." });
      await load(true);
    } catch (caught) {
      setMessage({ ok: false, text: caught instanceof Error ? caught.message : "Unable to save definition." });
    } finally {
      setSaving(false);
    }
  }

  async function submitDecision() {
    if (!accessToken || !decision) return;
    setSaving(true);
    try {
      const updated = decision.mode === "approve"
        ? await approveApprovalStep(accessToken, decision.approval.id, decision.step.id, decisionComment)
        : await rejectApprovalStep(accessToken, decision.approval.id, decision.step.id, decisionComment);
      replaceApproval(updated);
      setDecision(null);
      setDecisionComment("");
      setMessage({ ok: true, text: decision.mode === "approve" ? "Step approved." : "Step rejected." });
      await load(true);
    } catch (caught) {
      setMessage({ ok: false, text: caught instanceof Error ? caught.message : "Unable to submit decision." });
    } finally {
      setSaving(false);
    }
  }

  function confirmCancel(approval: Approval) {
    if (!accessToken) return;
    Alert.alert("Cancel approval?", "Pending steps will be cancelled.", [
      { style: "cancel", text: "No" },
      {
        style: "destructive",
        text: "Cancel approval",
        onPress: () => {
          void (async () => {
            try {
              replaceApproval(await cancelApproval(accessToken, approval.id));
              setMessage({ ok: true, text: "Approval cancelled." });
              await load(true);
            } catch (caught) {
              setMessage({ ok: false, text: caught instanceof Error ? caught.message : "Unable to cancel approval." });
            }
          })();
        },
      },
    ]);
  }

  function confirmReopen(approval: Approval) {
    if (!accessToken) return;
    Alert.alert("Reopen approval?", "All steps will reset to pending.", [
      { style: "cancel", text: "No" },
      {
        text: "Reopen",
        onPress: () => {
          void (async () => {
            try {
              replaceApproval(await reopenApproval(accessToken, approval.id));
              setMessage({ ok: true, text: "Approval reopened." });
              await load(true);
            } catch (caught) {
              setMessage({ ok: false, text: caught instanceof Error ? caught.message : "Unable to reopen approval." });
            }
          })();
        },
      },
    ]);
  }

  function confirmArchiveDefinition(definition: ApprovalDefinition) {
    if (!accessToken) return;
    const restoring = Boolean(definition.archivedAt);
    Alert.alert(restoring ? "Restore definition?" : "Archive definition?", restoring ? "This route can be used again." : "New requests cannot use this route until restored.", [
      { style: "cancel", text: "No" },
      {
        style: restoring ? "default" : "destructive",
        text: restoring ? "Restore" : "Archive",
        onPress: () => {
          void (async () => {
            try {
              const updated = restoring
                ? await restoreApprovalDefinition(accessToken, definition.id)
                : await archiveApprovalDefinition(accessToken, definition.id);
              setDefinitions((current) => current.map((item) => item.id === updated.id ? updated : item));
              setMessage({ ok: true, text: restoring ? "Definition restored." : "Definition archived." });
              await load(true);
            } catch (caught) {
              setMessage({ ok: false, text: caught instanceof Error ? caught.message : "Unable to update definition." });
            }
          })();
        },
      },
    ]);
  }

  function replaceApproval(updated: Approval) {
    setAllApprovals((current) => current.map((item) => item.id === updated.id ? updated : item));
    setPendingApprovals((current) => current.map((item) => item.id === updated.id ? updated : item).filter((item) => item.status === "PENDING" && item.steps.some((step) => isMyPendingStep(step, currentUserId))));
    setDetail((current) => current?.id === updated.id ? updated : current);
  }

  const approvalsForTab = activeTab === "pending" ? pendingApprovals : visibleApprovals;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.accent} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft color={colors.foreground} size={20} strokeWidth={2.7} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>Approvals</Text>
            <Text style={styles.title}>Approval Center</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={() => void load(true)} style={styles.iconButton}>
            <RefreshCw color={colors.foreground} size={19} strokeWidth={2.7} />
          </Pressable>
          <Pressable accessibilityRole="button" onPress={openRequestSheet} style={styles.primaryIconButton}>
            <Plus color={colors.black} size={22} strokeWidth={2.9} />
          </Pressable>
        </View>

        <View style={styles.metricStrip}>
          <Metric value={pendingApprovals.length} label="Yours" />
          <Metric value={waitingForOthers} label="Others" />
          <Metric value={activeDefinitions} label="Routes" />
        </View>

        <View style={styles.searchBox}>
          <Search color={colors.inkSoft} size={18} strokeWidth={2.5} />
          <TextInput
            placeholder="Search approvals, entity, reference..."
            placeholderTextColor={colors.inkSoft}
            value={query}
            onChangeText={setQuery}
            style={styles.searchInput}
          />
        </View>

        {message ? <MessageBanner message={message} onDismiss={() => setMessage(null)} /> : null}

        <ScrollView horizontal contentContainerStyle={styles.tabs} showsHorizontalScrollIndicator={false}>
          <Tab label="Pending" active={activeTab === "pending"} onPress={() => setActiveTab("pending")} />
          <Tab label="All approvals" active={activeTab === "all"} onPress={() => setActiveTab("all")} />
          <Tab label="Definitions" active={activeTab === "definitions"} onPress={() => setActiveTab("definitions")} />
        </ScrollView>

        {activeTab !== "definitions" ? (
          <ScrollView horizontal contentContainerStyle={styles.filters} showsHorizontalScrollIndicator={false}>
            <FilterPill label="All" active={filterStatus === "ALL"} onPress={() => setFilterStatus("ALL")} />
            {statuses.map((status) => <FilterPill key={status} label={statusLabel(status)} active={filterStatus === status} onPress={() => setFilterStatus(status)} />)}
          </ScrollView>
        ) : null}

        {loading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={colors.foreground} />
            <Text style={styles.loadingText}>Loading approvals...</Text>
          </View>
        ) : error ? (
          <EmptyState title="Approvals unavailable" description={error} />
        ) : activeTab === "definitions" ? (
          <DefinitionsList
            canManage={canManage}
            definitions={definitions}
            onArchiveRestore={confirmArchiveDefinition}
            onCreate={() => openDefinitionSheet()}
            onEdit={openDefinitionSheet}
            users={users}
          />
        ) : (
          <ApprovalsList
            approvals={approvalsForTab}
            canManage={canManage}
            currentUserId={currentUserId}
            onCancel={confirmCancel}
            onDecision={(approval, step, mode) => {
              setDecision({ approval, mode, step });
              setDecisionComment("");
            }}
            onOpen={setDetail}
            onReopen={confirmReopen}
            users={users}
          />
        )}
      </ScrollView>

      <ApprovalSheet
        definitions={definitions}
        form={approvalForm}
        open={sheet === "approval"}
        saving={saving}
        setForm={setApprovalForm}
        onClose={() => setSheet(null)}
        onSubmit={() => void submitApproval()}
        users={users}
      />
      <DefinitionSheet
        form={definitionForm}
        open={sheet === "definition"}
        saving={saving}
        setForm={setDefinitionForm}
        onClose={() => setSheet(null)}
        onSubmit={() => void submitDefinition()}
        users={users}
      />
      <DecisionSheet
        comment={decisionComment}
        decision={decision}
        saving={saving}
        setComment={setDecisionComment}
        onClose={() => setDecision(null)}
        onSubmit={() => void submitDecision()}
      />
      <DetailSheet
        approval={detail}
        canManage={canManage}
        currentUserId={currentUserId}
        onCancel={confirmCancel}
        onClose={() => setDetail(null)}
        onDecision={(approval, step, mode) => {
          setDetail(null);
          setDecision({ approval, mode, step });
          setDecisionComment("");
        }}
        onReopen={confirmReopen}
        users={users}
      />
    </SafeAreaView>
  );
}

function ApprovalsList({
  approvals,
  canManage,
  currentUserId,
  onCancel,
  onDecision,
  onOpen,
  onReopen,
  users,
}: {
  approvals: Approval[];
  canManage: boolean;
  currentUserId: string;
  onCancel: (approval: Approval) => void;
  onDecision: (approval: Approval, step: ApprovalStep, mode: DecisionMode) => void;
  onOpen: (approval: Approval) => void;
  onReopen: (approval: Approval) => void;
  users: TenantUser[];
}) {
  if (!approvals.length) {
    return <EmptyState title="No approvals here" description="Requests waiting for you, your team, or your definitions will show here." />;
  }

  return (
    <View style={styles.list}>
      {approvals.map((approval) => {
        const myStep = approval.steps.find((step) => isMyPendingStep(step, currentUserId));
        return (
          <Pressable key={approval.id} accessibilityRole="button" onPress={() => onOpen(approval)} style={({ pressed }) => [styles.approvalCard, pressed ? styles.pressed : null]}>
            <View style={styles.cardHeader}>
              <View style={styles.cardTitleBlock}>
                <StatusBadge status={approval.status} />
                <Text numberOfLines={2} style={styles.cardTitle}>{approval.title}</Text>
                <Text numberOfLines={1} style={styles.cardMeta}>{entityLabel(approval.entityType)} - {approval.entityId}</Text>
              </View>
              <View style={styles.cardIcon}>
                <ClipboardCheck color={colors.accent} size={19} strokeWidth={2.6} />
              </View>
            </View>

            {approval.description ? <Text numberOfLines={2} style={styles.cardDescription}>{approval.description}</Text> : null}

            <View style={styles.stepPreview}>
              {approval.steps.slice(0, 3).map((step) => (
                <View key={step.id} style={styles.stepPreviewRow}>
                  <StepDot status={step.status} />
                  <Text numberOfLines={1} style={styles.stepPreviewText}>{step.title ?? `Step ${step.stepOrder}`}</Text>
                  <Text numberOfLines={1} style={styles.stepPreviewUser}>{userName(users, step.approverId)}</Text>
                </View>
              ))}
            </View>

            <View style={styles.cardFooter}>
              <Text style={styles.smallMeta}>{approvedCount(approval)}/{approval.steps.length} complete</Text>
              <View style={styles.rowActions}>
                {myStep ? (
                  <>
                    <Pressable accessibilityRole="button" onPress={() => onDecision(approval, myStep, "reject")} style={styles.rejectAction}>
                      <Text style={styles.rejectActionText}>Reject</Text>
                    </Pressable>
                    <Pressable accessibilityRole="button" onPress={() => onDecision(approval, myStep, "approve")} style={styles.approveAction}>
                      <Text style={styles.approveActionText}>Approve</Text>
                    </Pressable>
                  </>
                ) : approval.status === "PENDING" ? (
                  <Pressable accessibilityRole="button" onPress={() => onCancel(approval)} style={styles.quietAction}>
                    <Text style={styles.quietActionText}>Cancel</Text>
                  </Pressable>
                ) : canManage ? (
                  <Pressable accessibilityRole="button" onPress={() => onReopen(approval)} style={styles.quietAction}>
                    <Text style={styles.quietActionText}>Reopen</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function DefinitionsList({
  canManage,
  definitions,
  onArchiveRestore,
  onCreate,
  onEdit,
  users,
}: {
  canManage: boolean;
  definitions: ApprovalDefinition[];
  onArchiveRestore: (definition: ApprovalDefinition) => void;
  onCreate: () => void;
  onEdit: (definition: ApprovalDefinition) => void;
  users: TenantUser[];
}) {
  return (
    <View style={styles.list}>
      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>Approval routes</Text>
          <Text style={styles.sectionMeta}>{definitions.length} definitions</Text>
        </View>
        <Pressable accessibilityRole="button" disabled={!canManage} onPress={onCreate} style={[styles.smallPrimaryButton, !canManage ? styles.disabled : null]}>
          <Plus color={colors.black} size={16} strokeWidth={2.9} />
          <Text style={styles.smallPrimaryText}>Route</Text>
        </Pressable>
      </View>
      {!definitions.length ? (
        <EmptyState title="No reusable routes" description="Create a route once, then reuse it when project, task, sprint, or document approval is needed." />
      ) : (
        definitions.map((definition) => (
          <View key={definition.id} style={[styles.definitionCard, definition.archivedAt ? styles.archivedDefinition : null]}>
            <View style={styles.cardHeader}>
              <View style={styles.cardTitleBlock}>
                <View style={styles.statusRow}>
                  <Text style={[styles.definitionState, definition.isActive && !definition.archivedAt ? styles.definitionActive : styles.definitionInactive]}>{definition.archivedAt ? "Archived" : definition.isActive ? "Active" : "Inactive"}</Text>
                  <Text style={styles.entityPill}>{entityLabel(definition.entityType)}</Text>
                </View>
                <Text numberOfLines={1} style={styles.cardTitle}>{definition.name}</Text>
                {definition.description ? <Text numberOfLines={2} style={styles.cardDescription}>{definition.description}</Text> : null}
              </View>
              <View style={styles.rowActions}>
                <Pressable accessibilityRole="button" disabled={!canManage} onPress={() => onEdit(definition)} style={[styles.quietAction, !canManage ? styles.disabled : null]}>
                  <Text style={styles.quietActionText}>Edit</Text>
                </Pressable>
                <Pressable accessibilityRole="button" disabled={!canManage} onPress={() => onArchiveRestore(definition)} style={[styles.iconMini, !canManage ? styles.disabled : null]}>
                  {definition.archivedAt ? <RotateCcw color={colors.foreground} size={16} /> : <Archive color={colors.foreground} size={16} />}
                </Pressable>
              </View>
            </View>
            <View style={styles.stepPreview}>
              {definition.steps.map((step) => (
                <View key={step.id ?? step.stepOrder} style={styles.definitionStep}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>{step.stepOrder}</Text>
                  </View>
                  <View style={styles.stepCopy}>
                    <Text numberOfLines={1} style={styles.stepTitle}>{step.title}</Text>
                    <Text numberOfLines={1} style={styles.stepUser}>{step.approverId ? userName(users, step.approverId) : step.approverRole ? `Role: ${step.approverRole}` : "No approver"}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        ))
      )}
    </View>
  );
}

function ApprovalSheet({
  definitions,
  form,
  open,
  saving,
  setForm,
  onClose,
  onSubmit,
  users,
}: {
  definitions: ApprovalDefinition[];
  form: ApprovalForm;
  open: boolean;
  saving: boolean;
  setForm: (next: ApprovalForm | ((current: ApprovalForm) => ApprovalForm)) => void;
  onClose: () => void;
  onSubmit: () => void;
  users: TenantUser[];
}) {
  return (
    <Sheet open={open} title="New approval" eyebrow="Request" onClose={onClose}>
      <Field label="Title">
        <TextInput value={form.title} onChangeText={(title) => setForm((current) => ({ ...current, title }))} placeholder="Budget change approval" placeholderTextColor={colors.inkSoft} style={styles.input} />
      </Field>
      <Field label="Entity type">
        <ChipRail values={entityTypes} selected={form.entityType} onSelect={(entityType) => setForm((current) => ({ ...current, entityType }))} />
      </Field>
      <Field label="Entity ID or reference">
        <TextInput value={form.entityId} onChangeText={(entityId) => setForm((current) => ({ ...current, entityId }))} placeholder="Project, task, or document id" placeholderTextColor={colors.inkSoft} style={styles.input} />
      </Field>
      <Field label="Reusable route">
        <ScrollView horizontal contentContainerStyle={styles.chipRail} showsHorizontalScrollIndicator={false}>
          <ChoiceChip label="Direct approver" active={!form.definitionId} onPress={() => setForm((current) => ({ ...current, definitionId: "" }))} />
          {definitions.filter((definition) => definition.isActive && !definition.archivedAt).map((definition) => (
            <ChoiceChip key={definition.id} label={definition.name} active={form.definitionId === definition.id} onPress={() => setForm((current) => ({ ...current, definitionId: definition.id }))} />
          ))}
        </ScrollView>
      </Field>
      {!form.definitionId ? (
        <View style={styles.subPanel}>
          <Field label="Step title">
            <TextInput value={form.stepTitle} onChangeText={(stepTitle) => setForm((current) => ({ ...current, stepTitle }))} placeholder="Review request" placeholderTextColor={colors.inkSoft} style={styles.input} />
          </Field>
          <Field label="Approver">
            <UserChooser selectedId={form.stepApproverId} users={users} onSelect={(stepApproverId) => setForm((current) => ({ ...current, stepApproverId, stepApproverRole: "" }))} />
          </Field>
        </View>
      ) : null}
      <Field label="Due date">
        <TextInput value={form.dueDate} onChangeText={(dueDate) => setForm((current) => ({ ...current, dueDate }))} placeholder="YYYY-MM-DD" placeholderTextColor={colors.inkSoft} style={styles.input} />
      </Field>
      <Field label="Description">
        <TextInput multiline value={form.description} onChangeText={(description) => setForm((current) => ({ ...current, description }))} placeholder="Decision context" placeholderTextColor={colors.inkSoft} style={[styles.input, styles.textArea]} />
      </Field>
      <SheetActions saving={saving} submitLabel="Create request" onClose={onClose} onSubmit={onSubmit} />
    </Sheet>
  );
}

function DefinitionSheet({
  form,
  open,
  saving,
  setForm,
  onClose,
  onSubmit,
  users,
}: {
  form: DefinitionForm;
  open: boolean;
  saving: boolean;
  setForm: (next: DefinitionForm | ((current: DefinitionForm) => DefinitionForm)) => void;
  onClose: () => void;
  onSubmit: () => void;
  users: TenantUser[];
}) {
  return (
    <Sheet open={open} title={form.id ? "Edit route" : "New route"} eyebrow="Definition" onClose={onClose}>
      <Field label="Route name">
        <TextInput value={form.name} onChangeText={(name) => setForm((current) => ({ ...current, name }))} placeholder="Project budget approval" placeholderTextColor={colors.inkSoft} style={styles.input} />
      </Field>
      <Field label="Entity type">
        <ChipRail values={entityTypes} selected={form.entityType} onSelect={(entityType) => setForm((current) => ({ ...current, entityType }))} />
      </Field>
      <Field label="Description">
        <TextInput multiline value={form.description} onChangeText={(description) => setForm((current) => ({ ...current, description }))} placeholder="When this route should be used" placeholderTextColor={colors.inkSoft} style={[styles.input, styles.textArea]} />
      </Field>
      <Pressable accessibilityRole="button" onPress={() => setForm((current) => ({ ...current, isActive: !current.isActive }))} style={styles.toggleRow}>
        <View style={[styles.checkBox, form.isActive ? styles.checkBoxActive : null]}>{form.isActive ? <CheckCircle2 color={colors.black} size={16} /> : null}</View>
        <Text style={styles.toggleText}>Active for new requests</Text>
      </Pressable>
      <View style={styles.sheetSectionHeader}>
        <Text style={styles.sheetSectionTitle}>Steps</Text>
        <Pressable accessibilityRole="button" onPress={() => setForm((current) => ({ ...current, steps: [...current.steps, emptyDraftStep()] }))} style={styles.addStepButton}>
          <Plus color={colors.black} size={15} strokeWidth={2.9} />
          <Text style={styles.addStepText}>Step</Text>
        </Pressable>
      </View>
      {form.steps.map((step, index) => (
        <View key={index} style={styles.stepEditor}>
          <View style={styles.stepEditorHeader}>
            <Text style={styles.stepEditorTitle}>Step {index + 1}</Text>
            {form.steps.length > 1 ? (
              <Pressable accessibilityRole="button" onPress={() => setForm((current) => ({ ...current, steps: current.steps.filter((_, stepIndex) => stepIndex !== index) }))}>
                <Text style={styles.removeText}>Remove</Text>
              </Pressable>
            ) : null}
          </View>
          <Field label="Title">
            <TextInput value={step.title} onChangeText={(title) => patchStep(setForm, index, { title })} placeholder="Review request" placeholderTextColor={colors.inkSoft} style={styles.input} />
          </Field>
          <Field label="Approver">
            <UserChooser selectedId={step.approverId} users={users} onSelect={(approverId) => patchStep(setForm, index, { approverId, approverRole: "" })} />
          </Field>
          <Field label="Role fallback">
            <TextInput value={step.approverRole} onChangeText={(approverRole) => patchStep(setForm, index, { approverRole, approverId: "" })} placeholder="Owner, Project Manager..." placeholderTextColor={colors.inkSoft} style={styles.input} />
          </Field>
          <Field label="Escalation hours">
            <TextInput keyboardType="number-pad" value={step.escalationHours} onChangeText={(escalationHours) => patchStep(setForm, index, { escalationHours })} placeholder="Optional" placeholderTextColor={colors.inkSoft} style={styles.input} />
          </Field>
        </View>
      ))}
      <SheetActions saving={saving} submitLabel={form.id ? "Save route" : "Create route"} onClose={onClose} onSubmit={onSubmit} />
    </Sheet>
  );
}

function DecisionSheet({
  comment,
  decision,
  saving,
  setComment,
  onClose,
  onSubmit,
}: {
  comment: string;
  decision: { approval: Approval; mode: DecisionMode; step: ApprovalStep } | null;
  saving: boolean;
  setComment: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <Sheet open={Boolean(decision)} title={decision?.mode === "approve" ? "Approve step" : "Reject step"} eyebrow={decision?.approval.title ?? "Decision"} onClose={onClose}>
      <View style={styles.subPanel}>
        <Text style={styles.stepEditorTitle}>{decision?.step.title ?? "Approval step"}</Text>
        <Text style={styles.helpText}>Your comment is saved to approval history.</Text>
      </View>
      <Field label="Comment">
        <TextInput multiline value={comment} onChangeText={setComment} placeholder="Reason, conditions, or context" placeholderTextColor={colors.inkSoft} style={[styles.input, styles.textArea]} />
      </Field>
      <SheetActions saving={saving} submitLabel={decision?.mode === "approve" ? "Approve" : "Reject"} danger={decision?.mode === "reject"} onClose={onClose} onSubmit={onSubmit} />
    </Sheet>
  );
}

function DetailSheet({
  approval,
  canManage,
  currentUserId,
  onCancel,
  onClose,
  onDecision,
  onReopen,
  users,
}: {
  approval: Approval | null;
  canManage: boolean;
  currentUserId: string;
  onCancel: (approval: Approval) => void;
  onClose: () => void;
  onDecision: (approval: Approval, step: ApprovalStep, mode: DecisionMode) => void;
  onReopen: (approval: Approval) => void;
  users: TenantUser[];
}) {
  if (!approval) return null;
  return (
    <Sheet open title={approval.title} eyebrow={`${entityLabel(approval.entityType)} - ${approval.entityId}`} onClose={onClose}>
      <View style={styles.detailStats}>
        <Metric value={statusLabel(approval.status)} label="Status" />
        <Metric value={approval.currentStep} label="Step" />
        <Metric value={approval.dueDate ? shortDate(approval.dueDate) : "No date"} label="Due" />
      </View>
      {approval.description ? <Text style={styles.detailDescription}>{approval.description}</Text> : null}
      <View style={styles.list}>
        {approval.steps.map((step) => {
          const mine = isMyPendingStep(step, currentUserId);
          return (
            <View key={step.id} style={styles.detailStep}>
              <View style={styles.detailStepHeader}>
                <StatusBadge status={step.status} />
                <Text style={styles.smallMeta}>Step {step.stepOrder}</Text>
              </View>
              <Text style={styles.stepTitle}>{step.title ?? "Approval step"}</Text>
              <Text style={styles.stepUser}>Approver: {userName(users, step.approverId)}</Text>
              {step.comments ? <Text style={styles.stepComment}>{step.comments}</Text> : null}
              {mine ? (
                <View style={styles.rowActions}>
                  <Pressable accessibilityRole="button" onPress={() => onDecision(approval, step, "reject")} style={styles.rejectAction}>
                    <Text style={styles.rejectActionText}>Reject</Text>
                  </Pressable>
                  <Pressable accessibilityRole="button" onPress={() => onDecision(approval, step, "approve")} style={styles.approveAction}>
                    <Text style={styles.approveActionText}>Approve</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          );
        })}
      </View>
      <View style={styles.sheetActions}>
        {approval.status === "PENDING" ? (
          <Pressable accessibilityRole="button" onPress={() => onCancel(approval)} style={styles.cancelButton}>
            <Text style={styles.cancelButtonText}>Cancel request</Text>
          </Pressable>
        ) : canManage ? (
          <Pressable accessibilityRole="button" onPress={() => onReopen(approval)} style={styles.cancelButton}>
            <Text style={styles.cancelButtonText}>Reopen request</Text>
          </Pressable>
        ) : null}
      </View>
    </Sheet>
  );
}

function Sheet({ children, eyebrow, open, title, onClose }: { children: ReactNode; eyebrow: string; open: boolean; title: string; onClose: () => void }) {
  return (
    <Modal animationType="slide" transparent visible={open} onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalLayer}>
        <Pressable accessibilityRole="button" onPress={onClose} style={styles.modalScrim} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <View style={styles.sheetTitleBlock}>
              <Text style={styles.eyebrow}>{eyebrow}</Text>
              <Text numberOfLines={2} style={styles.sheetTitle}>{title}</Text>
            </View>
            <Pressable accessibilityRole="button" onPress={onClose} style={styles.iconButton}>
              <X color={colors.foreground} size={18} strokeWidth={2.7} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function SheetActions({ danger, saving, submitLabel, onClose, onSubmit }: { danger?: boolean; saving: boolean; submitLabel: string; onClose: () => void; onSubmit: () => void }) {
  return (
    <View style={styles.sheetActions}>
      <Pressable accessibilityRole="button" onPress={onClose} style={styles.cancelButton}>
        <Text style={styles.cancelButtonText}>Cancel</Text>
      </Pressable>
      <Pressable accessibilityRole="button" disabled={saving} onPress={onSubmit} style={[styles.submitButton, danger ? styles.submitDanger : null, saving ? styles.disabled : null]}>
        {saving ? <ActivityIndicator color={colors.black} /> : <ShieldCheck color={danger ? colors.white : colors.black} size={17} strokeWidth={2.8} />}
        <Text style={[styles.submitButtonText, danger ? styles.submitDangerText : null]}>{submitLabel}</Text>
      </Pressable>
    </View>
  );
}

function Field({ children, label }: { children: ReactNode; label: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function ChipRail({ selected, values, onSelect }: { selected: string; values: string[]; onSelect: (value: string) => void }) {
  return (
    <ScrollView horizontal contentContainerStyle={styles.chipRail} showsHorizontalScrollIndicator={false}>
      {values.map((value) => <ChoiceChip key={value} label={entityLabel(value)} active={selected === value} onPress={() => onSelect(value)} />)}
    </ScrollView>
  );
}

function UserChooser({ selectedId, users, onSelect }: { selectedId: string; users: TenantUser[]; onSelect: (userId: string) => void }) {
  return (
    <ScrollView horizontal contentContainerStyle={styles.userChooser} showsHorizontalScrollIndicator={false}>
      {users.map((user) => (
        <Pressable key={user.id} accessibilityRole="button" onPress={() => onSelect(user.id)} style={[styles.userChoice, selectedId === user.id ? styles.userChoiceActive : null]}>
          <View style={styles.userAvatar}>
            <Text style={styles.userAvatarText}>{initials(user)}</Text>
          </View>
          <View style={styles.userChoiceCopy}>
            <Text numberOfLines={1} style={styles.userChoiceName}>{displayUser(user)}</Text>
            <Text numberOfLines={1} style={styles.userChoiceEmail}>{user.email}</Text>
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function ChoiceChip({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.choiceChip, active ? styles.choiceChipActive : null]}>
      <Text style={[styles.choiceChipText, active ? styles.choiceChipTextActive : null]}>{label}</Text>
    </Pressable>
  );
}

function Tab({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.tab, active ? styles.tabActive : null]}>
      <Text style={[styles.tabText, active ? styles.tabTextActive : null]}>{label}</Text>
    </Pressable>
  );
}

function FilterPill({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.filterPill, active ? styles.filterPillActive : null]}>
      <Text style={[styles.filterPillText, active ? styles.filterPillTextActive : null]}>{label}</Text>
    </Pressable>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <View style={styles.metric}>
      <Text numberOfLines={1} style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function StatusBadge({ status }: { status: ApprovalStatus }) {
  const Icon = status === "APPROVED" ? CheckCircle2 : status === "REJECTED" ? XCircle : status === "CANCELLED" ? Ban : Clock3;
  const palette = statusPalette(status);
  return (
    <View style={[styles.statusBadge, { backgroundColor: palette.bg }]}>
      <Icon color={palette.fg} size={13} strokeWidth={2.7} />
      <Text style={[styles.statusText, { color: palette.fg }]}>{statusLabel(status)}</Text>
    </View>
  );
}

function StepDot({ status }: { status: ApprovalStatus }) {
  return <View style={[styles.stepDot, { backgroundColor: statusPalette(status).fg }]} />;
}

function MessageBanner({ message, onDismiss }: { message: { ok: boolean; text: string }; onDismiss: () => void }) {
  return (
    <View style={[styles.message, message.ok ? styles.messageOk : styles.messageBad]}>
      <Text style={[styles.messageText, message.ok ? styles.messageOkText : styles.messageBadText]}>{message.text}</Text>
      <Pressable accessibilityRole="button" onPress={onDismiss}>
        <X color={message.ok ? colors.success : colors.danger} size={16} strokeWidth={2.8} />
      </Pressable>
    </View>
  );
}

function EmptyState({ description, title }: { description: string; title: string }) {
  return (
    <View style={styles.emptyCard}>
      <View style={styles.emptyIcon}>
        <ClipboardCheck color={colors.accent} size={24} strokeWidth={2.8} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{description}</Text>
    </View>
  );
}

function emptyApprovalForm(): ApprovalForm {
  return {
    definitionId: "",
    description: "",
    dueDate: "",
    entityId: "",
    entityType: "PROJECT",
    stepApproverId: "",
    stepApproverRole: "",
    stepTitle: "Review request",
    title: "",
  };
}

function emptyDefinitionForm(): DefinitionForm {
  return {
    description: "",
    entityType: "PROJECT",
    isActive: true,
    name: "",
    steps: [emptyDraftStep()],
  };
}

function emptyDraftStep(): DraftStep {
  return {
    approverId: "",
    approverRole: "",
    escalationHours: "",
    required: true,
    title: "Review request",
  };
}

function buildApprovalSteps(form: ApprovalForm): ApprovalStepInput[] {
  if (!form.stepApproverId && !form.stepApproverRole) return [];
  return [{
    approverId: form.stepApproverId || undefined,
    approverRole: form.stepApproverRole || undefined,
    required: true,
    stepOrder: 1,
    title: form.stepTitle.trim() || "Review request",
  }];
}

function buildDefinitionSteps(steps: DraftStep[]): ApprovalStepInput[] {
  return steps
    .map((step, index) => ({
      approverId: step.approverId || undefined,
      approverRole: step.approverRole.trim() || undefined,
      escalationHours: step.escalationHours ? Number(step.escalationHours) : undefined,
      required: step.required,
      stepOrder: index + 1,
      title: step.title.trim() || `Step ${index + 1}`,
    }))
    .filter((step) => step.approverId || step.approverRole);
}

function patchStep(
  setForm: (next: DefinitionForm | ((current: DefinitionForm) => DefinitionForm)) => void,
  index: number,
  patch: Partial<DraftStep>,
) {
  setForm((current) => ({
    ...current,
    steps: current.steps.map((step, stepIndex) => stepIndex === index ? { ...step, ...patch } : step),
  }));
}

function isMyPendingStep(step: ApprovalStep, userId: string) {
  return step.approverId === userId && step.status === "PENDING";
}

function approvedCount(approval: Approval) {
  return approval.steps.filter((step) => step.status === "APPROVED").length;
}

function statusLabel(status: ApprovalStatus) {
  return status.toLowerCase().replace(/_/g, " ");
}

function entityLabel(value: string) {
  return value.toLowerCase().replace(/_/g, " ");
}

function statusPalette(status: ApprovalStatus) {
  if (status === "APPROVED") return { bg: colors.greenSoft, fg: colors.success };
  if (status === "REJECTED") return { bg: colors.redSoft, fg: colors.danger };
  if (status === "CANCELLED") return { bg: colors.panelMuted, fg: colors.inkSoft };
  return { bg: colors.yellowSoft, fg: colors.warning };
}

function displayUser(user: TenantUser) {
  const name = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim();
  return name || user.email;
}

function userName(users: TenantUser[], userId: string) {
  const user = users.find((item) => item.id === userId);
  return user ? displayUser(user) : "Unknown user";
}

function initials(user: TenantUser) {
  const text = `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`.trim();
  return (text || user.email.slice(0, 2)).toUpperCase();
}

function shortDate(value: string) {
  try {
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(value));
  } catch {
    return value.slice(0, 10);
  }
}

const styles = withFontStyles(StyleSheet.create({
  safe: { backgroundColor: colors.background, flex: 1 },
  content: { gap: 16, padding: 20, paddingBottom: 130 },
  header: { alignItems: "center", flexDirection: "row", gap: 10, paddingTop: 2 },
  backButton: { alignItems: "center", backgroundColor: colors.panel, borderRadius: 18, height: 46, justifyContent: "center", width: 46, ...shadow.card },
  headerCopy: { flex: 1 },
  eyebrow: { color: colors.accent, fontSize: 11, fontWeight: "900", letterSpacing: 1.2, textTransform: "uppercase" },
  title: { color: colors.foreground, fontSize: 29, fontWeight: "900", letterSpacing: -0.5 },
  iconButton: { alignItems: "center", backgroundColor: colors.panel, borderRadius: 18, height: 46, justifyContent: "center", width: 46, ...shadow.card },
  primaryIconButton: { alignItems: "center", backgroundColor: colors.primary, borderRadius: 18, height: 46, justifyContent: "center", width: 46, ...shadow.card },
  metricStrip: { backgroundColor: colors.panel, borderRadius: radii.xl, flexDirection: "row", padding: 8, ...shadow.card },
  metric: { alignItems: "center", flex: 1, justifyContent: "center", paddingVertical: 10 },
  metricLabel: { color: colors.inkSoft, fontSize: 9, fontWeight: "900", letterSpacing: 0.8, marginTop: 4, textTransform: "uppercase" },
  metricValue: { color: colors.foreground, fontSize: 19, fontWeight: "900" },
  searchBox: { alignItems: "center", backgroundColor: colors.panel, borderRadius: 22, flexDirection: "row", gap: 10, minHeight: 58, paddingHorizontal: 16, ...shadow.card },
  searchInput: { color: colors.foreground, flex: 1, fontSize: 14, fontWeight: "800" },
  tabs: { gap: 8 },
  tab: { backgroundColor: colors.panel, borderRadius: 17, paddingHorizontal: 16, paddingVertical: 11 },
  tabActive: { backgroundColor: colors.black },
  tabText: { color: colors.inkSoft, fontSize: 13, fontWeight: "900" },
  tabTextActive: { color: colors.primary },
  filters: { gap: 8 },
  filterPill: { backgroundColor: colors.panel, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 9 },
  filterPillActive: { backgroundColor: colors.primary },
  filterPillText: { color: colors.inkSoft, fontSize: 12, fontWeight: "900", textTransform: "capitalize" },
  filterPillTextActive: { color: colors.black },
  list: { gap: 12 },
  approvalCard: { backgroundColor: colors.panel, borderRadius: radii.xl, padding: 16, ...shadow.card },
  definitionCard: { backgroundColor: colors.panel, borderRadius: radii.xl, padding: 16, ...shadow.card },
  archivedDefinition: { opacity: 0.7 },
  pressed: { opacity: 0.75, transform: [{ scale: 0.995 }] },
  cardHeader: { alignItems: "flex-start", flexDirection: "row", gap: 12, justifyContent: "space-between" },
  cardTitleBlock: { flex: 1, minWidth: 0 },
  cardTitle: { color: colors.foreground, fontSize: 18, fontWeight: "900", letterSpacing: -0.2, marginTop: 8 },
  cardMeta: { color: colors.accent, fontSize: 11, fontWeight: "900", letterSpacing: 0.5, marginTop: 4, textTransform: "uppercase" },
  cardDescription: { color: colors.inkSoft, fontSize: 12, fontWeight: "700", lineHeight: 18, marginTop: 10 },
  cardIcon: { alignItems: "center", backgroundColor: colors.blueSoft, borderRadius: 16, height: 42, justifyContent: "center", width: 42 },
  statusBadge: { alignItems: "center", alignSelf: "flex-start", borderRadius: 999, flexDirection: "row", gap: 5, paddingHorizontal: 9, paddingVertical: 5 },
  statusText: { fontSize: 10, fontWeight: "900", textTransform: "uppercase" },
  statusRow: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 8 },
  entityPill: { backgroundColor: colors.blueSoft, borderRadius: 999, color: colors.accent, fontSize: 10, fontWeight: "900", paddingHorizontal: 9, paddingVertical: 5, textTransform: "capitalize" },
  definitionState: { borderRadius: 999, fontSize: 10, fontWeight: "900", paddingHorizontal: 9, paddingVertical: 5, textTransform: "uppercase" },
  definitionActive: { backgroundColor: colors.greenSoft, color: colors.success },
  definitionInactive: { backgroundColor: colors.panelMuted, color: colors.inkSoft },
  stepPreview: { gap: 8, marginTop: 14 },
  stepPreviewRow: { alignItems: "center", flexDirection: "row", gap: 8 },
  stepPreviewText: { color: colors.foreground, flex: 1, fontSize: 12, fontWeight: "800" },
  stepPreviewUser: { color: colors.inkSoft, flexShrink: 1, fontSize: 11, fontWeight: "700", maxWidth: 118 },
  stepDot: { borderRadius: 999, height: 8, width: 8 },
  cardFooter: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginTop: 15 },
  smallMeta: { color: colors.inkSoft, fontSize: 10, fontWeight: "900", letterSpacing: 0.6, textTransform: "uppercase" },
  rowActions: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 8 },
  quietAction: { borderColor: colors.line, borderRadius: 14, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 9 },
  quietActionText: { color: colors.foreground, fontSize: 11, fontWeight: "900" },
  approveAction: { backgroundColor: colors.success, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 9 },
  approveActionText: { color: colors.white, fontSize: 11, fontWeight: "900" },
  rejectAction: { backgroundColor: colors.redSoft, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 9 },
  rejectActionText: { color: colors.danger, fontSize: 11, fontWeight: "900" },
  sectionHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  sectionTitle: { color: colors.foreground, fontSize: 19, fontWeight: "900" },
  sectionMeta: { color: colors.inkSoft, fontSize: 11, fontWeight: "800", marginTop: 2 },
  smallPrimaryButton: { alignItems: "center", backgroundColor: colors.primary, borderRadius: 16, flexDirection: "row", gap: 6, paddingHorizontal: 14, paddingVertical: 10 },
  smallPrimaryText: { color: colors.black, fontSize: 12, fontWeight: "900" },
  iconMini: { alignItems: "center", borderColor: colors.line, borderRadius: 14, borderWidth: 1, height: 36, justifyContent: "center", width: 36 },
  definitionStep: { alignItems: "center", backgroundColor: colors.panelMuted, borderRadius: 16, flexDirection: "row", gap: 10, padding: 10 },
  stepNumber: { alignItems: "center", backgroundColor: colors.panel, borderRadius: 12, height: 30, justifyContent: "center", width: 30 },
  stepNumberText: { color: colors.foreground, fontSize: 12, fontWeight: "900" },
  stepCopy: { flex: 1, minWidth: 0 },
  stepTitle: { color: colors.foreground, fontSize: 14, fontWeight: "900" },
  stepUser: { color: colors.inkSoft, fontSize: 11, fontWeight: "700", marginTop: 3 },
  message: { alignItems: "center", borderRadius: 18, borderWidth: 1, flexDirection: "row", gap: 10, justifyContent: "space-between", padding: 13 },
  messageOk: { backgroundColor: colors.greenSoft, borderColor: "#bbf7d0" },
  messageBad: { backgroundColor: colors.redSoft, borderColor: "#fecaca" },
  messageText: { flex: 1, fontSize: 12, fontWeight: "900" },
  messageOkText: { color: colors.success },
  messageBadText: { color: colors.danger },
  loadingCard: { alignItems: "center", backgroundColor: colors.panel, borderRadius: radii.xl, gap: 10, justifyContent: "center", minHeight: 180, ...shadow.card },
  loadingText: { color: colors.inkSoft, fontSize: 13, fontWeight: "800" },
  emptyCard: { alignItems: "center", backgroundColor: colors.panel, borderRadius: radii.xl, padding: 24, ...shadow.card },
  emptyIcon: { alignItems: "center", backgroundColor: colors.blueSoft, borderRadius: 20, height: 54, justifyContent: "center", width: 54 },
  emptyTitle: { color: colors.foreground, fontSize: 18, fontWeight: "900", marginTop: 14, textAlign: "center" },
  emptyText: { color: colors.inkSoft, fontSize: 13, fontWeight: "700", lineHeight: 19, marginTop: 6, textAlign: "center" },
  modalLayer: { flex: 1, justifyContent: "flex-end" },
  modalScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(16,16,15,0.42)" },
  sheet: { backgroundColor: colors.background, borderTopLeftRadius: 30, borderTopRightRadius: 30, maxHeight: "92%", minHeight: "52%", overflow: "hidden" },
  sheetHandle: { alignSelf: "center", backgroundColor: colors.line, borderRadius: 999, height: 4, marginTop: 10, width: 42 },
  sheetHeader: { alignItems: "flex-start", flexDirection: "row", gap: 12, justifyContent: "space-between", padding: 20, paddingBottom: 12 },
  sheetTitleBlock: { flex: 1, minWidth: 0 },
  sheetTitle: { color: colors.foreground, fontSize: 24, fontWeight: "900", letterSpacing: -0.4, marginTop: 2 },
  sheetBody: { gap: 15, padding: 20, paddingTop: 0 },
  field: { gap: 7 },
  fieldLabel: { color: colors.foreground, fontSize: 12, fontWeight: "900" },
  input: { backgroundColor: colors.panel, borderColor: colors.line, borderRadius: 18, borderWidth: 1, color: colors.foreground, fontSize: 14, fontWeight: "800", minHeight: 54, paddingHorizontal: 15 },
  textArea: { minHeight: 104, paddingTop: 14, textAlignVertical: "top" },
  chipRail: { gap: 8, paddingRight: 18 },
  choiceChip: { backgroundColor: colors.panel, borderColor: colors.line, borderRadius: 16, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 10 },
  choiceChipActive: { backgroundColor: colors.black, borderColor: colors.black },
  choiceChipText: { color: colors.inkSoft, fontSize: 12, fontWeight: "900", textTransform: "capitalize" },
  choiceChipTextActive: { color: colors.primary },
  subPanel: { backgroundColor: colors.panelMuted, borderColor: colors.line, borderRadius: 22, borderWidth: 1, gap: 13, padding: 14 },
  userChooser: { gap: 9, paddingRight: 18 },
  userChoice: { alignItems: "center", backgroundColor: colors.panel, borderColor: colors.line, borderRadius: 18, borderWidth: 1, flexDirection: "row", gap: 10, maxWidth: 230, padding: 10 },
  userChoiceActive: { borderColor: colors.primaryDark, backgroundColor: colors.yellowSoft },
  userAvatar: { alignItems: "center", backgroundColor: colors.primary, borderRadius: 14, height: 34, justifyContent: "center", width: 34 },
  userAvatarText: { color: colors.black, fontSize: 11, fontWeight: "900" },
  userChoiceCopy: { minWidth: 0 },
  userChoiceName: { color: colors.foreground, fontSize: 12, fontWeight: "900" },
  userChoiceEmail: { color: colors.inkSoft, fontSize: 10, fontWeight: "700", marginTop: 2 },
  toggleRow: { alignItems: "center", flexDirection: "row", gap: 10 },
  checkBox: { alignItems: "center", backgroundColor: colors.panel, borderColor: colors.line, borderRadius: 10, borderWidth: 1, height: 28, justifyContent: "center", width: 28 },
  checkBoxActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  toggleText: { color: colors.foreground, fontSize: 13, fontWeight: "900" },
  sheetSectionHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  sheetSectionTitle: { color: colors.foreground, fontSize: 16, fontWeight: "900" },
  addStepButton: { alignItems: "center", backgroundColor: colors.primary, borderRadius: 14, flexDirection: "row", gap: 5, paddingHorizontal: 10, paddingVertical: 8 },
  addStepText: { color: colors.black, fontSize: 11, fontWeight: "900" },
  stepEditor: { backgroundColor: colors.panel, borderColor: colors.line, borderRadius: 22, borderWidth: 1, gap: 12, padding: 14 },
  stepEditorHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  stepEditorTitle: { color: colors.foreground, fontSize: 15, fontWeight: "900" },
  removeText: { color: colors.danger, fontSize: 12, fontWeight: "900" },
  helpText: { color: colors.inkSoft, fontSize: 12, fontWeight: "700", lineHeight: 18 },
  sheetActions: { alignItems: "center", flexDirection: "row", gap: 10, justifyContent: "flex-end", paddingTop: 5 },
  cancelButton: { alignItems: "center", backgroundColor: colors.panel, borderColor: colors.line, borderRadius: 18, borderWidth: 1, justifyContent: "center", minHeight: 50, paddingHorizontal: 16 },
  cancelButtonText: { color: colors.foreground, fontSize: 13, fontWeight: "900" },
  submitButton: { alignItems: "center", backgroundColor: colors.primary, borderRadius: 18, flexDirection: "row", gap: 8, justifyContent: "center", minHeight: 50, paddingHorizontal: 18 },
  submitDanger: { backgroundColor: colors.danger },
  submitButtonText: { color: colors.black, fontSize: 13, fontWeight: "900" },
  submitDangerText: { color: colors.white },
  disabled: { opacity: 0.5 },
  detailStats: { backgroundColor: colors.panel, borderRadius: radii.xl, flexDirection: "row", padding: 8, ...shadow.card },
  detailDescription: { backgroundColor: colors.panel, borderColor: colors.line, borderRadius: 20, borderWidth: 1, color: colors.inkSoft, fontSize: 13, fontWeight: "700", lineHeight: 20, padding: 14 },
  detailStep: { backgroundColor: colors.panel, borderColor: colors.line, borderRadius: 20, borderWidth: 1, gap: 9, padding: 14 },
  detailStepHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  stepComment: { backgroundColor: colors.panelMuted, borderRadius: 14, color: colors.inkSoft, fontSize: 12, fontWeight: "700", lineHeight: 18, padding: 10 },
}));
