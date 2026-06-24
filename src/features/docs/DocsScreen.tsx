import { ComponentType, useCallback, useEffect, useMemo, useState } from "react";
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
  BookOpenText,
  Building2,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  FileText,
  Folder,
  FolderArchive,
  FolderPlus,
  Globe,
  History,
  Lightbulb,
  ListChecks,
  Lock,
  PenLine,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Send,
  Shield,
  Terminal,
  Trash2,
  Users,
  X,
} from "lucide-react-native";
import {
  archiveDocument,
  archiveDocumentFolder,
  createDocument,
  createDocumentFolder,
  hardDeleteDocument,
  listDocumentFolders,
  listDocumentVersions,
  listDocuments,
  listProjects,
  publishDocument,
  restoreDocument,
  restoreDocumentFolder,
  restoreDocumentVersion,
  updateDocument,
  type CreateDocumentPayload,
  type UpdateDocumentPayload,
} from "@/lib/api";
import { ApiError } from "@/lib/api/request";
import { useAuthSession } from "@/lib/auth/AuthSessionProvider";
import { withFontStyles } from "@/lib/theme/fontDefaults";
import { colors, shadow } from "@/lib/theme/tokens";
import type { DocumentFolder, DocumentStatus, DocumentVersion, Project, Visibility, WorkspaceDocument } from "@/lib/types";

type EditorMode = "create" | "edit";
type EditorState = {
  document: WorkspaceDocument | null;
  mode: EditorMode;
} | null;
type FeedbackMessage = { ok: boolean; text: string } | null;

type DocumentForm = {
  body: string;
  changeNote: string;
  documentType: string;
  folderId: string;
  projectId: string;
  slug: string;
  status: DocumentStatus;
  summary: string;
  tagsText: string;
  title: string;
  visibility: Visibility;
};

const emptyForm: DocumentForm = {
  body: "",
  changeNote: "",
  documentType: "GENERAL",
  folderId: "",
  projectId: "",
  slug: "",
  status: "DRAFT",
  summary: "",
  tagsText: "",
  title: "",
  visibility: "TEAM",
};

const statusOptions: DocumentStatus[] = ["DRAFT", "PUBLISHED", "ARCHIVED"];
const visibilityOptions: Visibility[] = ["PRIVATE", "TEAM", "WORKSPACE", "ORGANIZATION", "PUBLIC"];

type DocIcon = ComponentType<{ color?: string; size?: number; strokeWidth?: number }>;
type TemplateItem = { bg: string; body: string; color: string; icon: DocIcon; label: string; type: string };

const DOC_TEMPLATES: TemplateItem[] = [
  { bg: colors.blueSoft, body: "", color: colors.accent, icon: FileText, label: "Blank", type: "GENERAL" },
  { bg: "#f3eeff", body: "# Standard Operating Procedure\n\n## Purpose\n\n## Scope\n\n## Responsibilities\n\n## Procedure\n\n### Step 1\n\n### Step 2\n\n## References", color: "#7c3aed", icon: ClipboardList, label: "SOP", type: "SOP" },
  { bg: "#e0fdf4", body: "# Operational Runbook\n\n## Overview\n\n## Prerequisites\n\n## Steps\n\n```bash\n# commands here\n```\n\n## Rollback\n\n## Verification\n- [ ] Check all services running\n\n## Contacts", color: "#0d9488", icon: Terminal, label: "Runbook", type: "RUNBOOK" },
  { bg: colors.orangeSoft, body: "# Decision Record\n\n## Context\n\n## Decision\n\n## Consequences\n\n## Alternatives Considered\n\n## Status\nProposed", color: colors.warning, icon: Lightbulb, label: "Decision", type: "DECISION" },
  { bg: "#fce7f3", body: "# Meeting Notes\n\n**Date:** \n**Attendees:** \n\n## Agenda\n\n## Discussion\n\n## Action Items\n- [ ] \n\n## Next Steps", color: "#be185d", icon: Users, label: "Meeting", type: "MEETING_NOTE" },
  { bg: "#e0f2fe", body: "# Policy\n\n## Purpose\n\n## Scope\n\n## Policy Statement\n\n## Exceptions\n\n## Enforcement\n\n## Review Date", color: "#0369a1", icon: Shield, label: "Policy", type: "POLICY" },
  { bg: colors.greenSoft, body: "# Requirements\n\n## Overview\n\n## Functional Requirements\n- [ ] FR-001: \n\n## Non-Functional Requirements\n- [ ] NFR-001: \n\n## Acceptance Criteria", color: colors.success, icon: ListChecks, label: "Requirement", type: "REQUIREMENT" },
];

const STATUS_OPTS = [
  { bg: colors.yellowSoft, color: colors.warning, icon: PenLine, label: "Draft", value: "DRAFT" as DocumentStatus },
  { bg: colors.greenSoft, color: colors.success, icon: CheckCircle2, label: "Published", value: "PUBLISHED" as DocumentStatus },
  { bg: "#f3eeff", color: "#7c3aed", icon: Archive, label: "Archived", value: "ARCHIVED" as DocumentStatus },
];

const VISIBILITY_OPTS = [
  { icon: Lock, label: "Private", sub: "Only you", value: "PRIVATE" as Visibility },
  { icon: Users, label: "Team", sub: "Your team", value: "TEAM" as Visibility },
  { icon: Globe, label: "Workspace", sub: "All members", value: "WORKSPACE" as Visibility },
  { icon: Building2, label: "Org", sub: "All orgs", value: "ORGANIZATION" as Visibility },
  { icon: Globe, label: "Public", sub: "Anyone", value: "PUBLIC" as Visibility },
];

export function DocsScreen() {
  const { accessToken } = useAuthSession();
  const [documents, setDocuments] = useState<WorkspaceDocument[]>([]);
  const [editor, setEditor] = useState<EditorState>(null);
  const [error, setError] = useState("");
  const [editorMessage, setEditorMessage] = useState<FeedbackMessage>(null);
  const [folderDescription, setFolderDescription] = useState("");
  const [folderMessage, setFolderMessage] = useState<FeedbackMessage>(null);
  const [folderName, setFolderName] = useState("");
  const [folderOpen, setFolderOpen] = useState(false);
  const [folders, setFolders] = useState<DocumentFolder[]>([]);
  const [form, setForm] = useState<DocumentForm>(emptyForm);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<FeedbackMessage>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedFolderId, setSelectedFolderId] = useState("ALL");
  const [selectedStatus, setSelectedStatus] = useState<"ALL" | DocumentStatus>("ALL");
  const [selectedVisibility, setSelectedVisibility] = useState<"ALL" | Visibility>("ALL");
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);

  const query = useMemo(
    () => ({
      folderId: selectedFolderId === "ALL" ? undefined : selectedFolderId,
      includeArchived,
      search: search.trim() || undefined,
      status: selectedStatus === "ALL" ? undefined : selectedStatus,
      visibility: selectedVisibility === "ALL" ? undefined : selectedVisibility,
    }),
    [includeArchived, search, selectedFolderId, selectedStatus, selectedVisibility],
  );

  const metrics = useMemo(() => {
    const draft = documents.filter((document) => document.status === "DRAFT").length;
    const published = documents.filter((document) => document.status === "PUBLISHED").length;
    const archived = documents.filter((document) => document.status === "ARCHIVED" || document.archivedAt).length;
    const versionCount = documents.reduce((total, document) => total + (document._count?.versions ?? 0), 0);
    return { archived, draft, published, total: documents.length, versionCount };
  }, [documents]);

  const load = useCallback(async (showRefreshing = false) => {
    if (!accessToken) return;
    if (showRefreshing) setRefreshing(true);
    else setLoading(true);
    setError("");

    try {
      const [folderPage, documentPage, projectPage] = await Promise.all([
        listDocumentFolders(accessToken, { includeArchived, limit: 100 }),
        listDocuments(accessToken, { ...query, limit: 75 }),
        listProjects(accessToken, { limit: 100 }),
      ]);

      setFolders(folderPage.data);
      setDocuments(documentPage.data);
      setProjects(Array.isArray(projectPage) ? projectPage : projectPage.data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load documents.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [accessToken, includeArchived, query]);

  useEffect(() => {
    void load();
  }, [load]);

  async function loadVersions(documentId: string) {
    if (!accessToken) return;
    setVersionsLoading(true);
    try {
      const nextVersions = await listDocumentVersions(accessToken, documentId);
      setVersions(nextVersions);
    } catch {
      setVersions([]);
    } finally {
      setVersionsLoading(false);
    }
  }

  function openCreateDocument() {
    setForm(emptyForm);
    setEditorMessage(null);
    setMessage(null);
    setVersions([]);
    setEditor({ document: null, mode: "create" });
  }

  function openEditDocument(document: WorkspaceDocument) {
    setForm(formFromDocument(document));
    setEditorMessage(null);
    setMessage(null);
    setEditor({ document, mode: "edit" });
    void loadVersions(document.id);
  }

  async function saveDocument() {
    if (!accessToken) {
      setEditorMessage({ ok: false, text: "Your session is not available. Sign in again before saving documents." });
      return;
    }
    if (!form.title.trim()) {
      setEditorMessage({ ok: false, text: "Add a document title before saving." });
      return;
    }
    setSaving(true);
    setMessage(null);
    setEditorMessage(null);

    try {
      const payload = formToPayload(form);
      if (editor?.mode === "edit" && editor.document) {
        const updated = await updateDocument(accessToken, editor.document.id, payload as UpdateDocumentPayload);
        setDocuments((current) => current.map((document) => (document.id === updated.id ? updated : document)));
        setEditor({ document: updated, mode: "edit" });
        await loadVersions(updated.id);
        setEditorMessage({ ok: true, text: "Document updated." });
        setMessage({ ok: true, text: "Document updated." });
      } else {
        const created = await createDocument(accessToken, payload as CreateDocumentPayload);
        setDocuments((current) => [created, ...current]);
        setEditor({ document: created, mode: "edit" });
        await loadVersions(created.id);
        setEditorMessage({ ok: true, text: "Document created." });
        setMessage({ ok: true, text: "Document created." });
      }
    } catch (caught) {
      const text = formatApiFailure(caught, "Unable to save document.");
      setEditorMessage({ ok: false, text });
      setMessage({ ok: false, text });
    } finally {
      setSaving(false);
    }
  }

  async function createFolder() {
    if (!accessToken) {
      setFolderMessage({ ok: false, text: "Your session is not available. Sign in again before creating folders." });
      return;
    }
    if (!folderName.trim()) {
      setFolderMessage({ ok: false, text: "Add a folder name before saving." });
      return;
    }
    setSaving(true);
    setMessage(null);
    setFolderMessage(null);

    try {
      const folder = await createDocumentFolder(accessToken, {
        description: folderDescription.trim() || undefined,
        name: folderName.trim(),
      });
      setFolders((current) => [folder, ...current]);
      setFolderName("");
      setFolderDescription("");
      setFolderOpen(false);
      setSelectedFolderId(folder.id);
      setMessage({ ok: true, text: "Folder created." });
    } catch (caught) {
      const text = formatApiFailure(caught, "Unable to create folder.");
      setFolderMessage({ ok: false, text });
      setMessage({ ok: false, text });
    } finally {
      setSaving(false);
    }
  }

  async function toggleFolderArchive(folder: DocumentFolder) {
    if (!accessToken) return;
    try {
      const nextFolder = folder.archivedAt
        ? await restoreDocumentFolder(accessToken, folder.id)
        : await archiveDocumentFolder(accessToken, folder.id);
      setFolders((current) => current.map((item) => (item.id === nextFolder.id ? nextFolder : item)));
      setMessage({ ok: true, text: folder.archivedAt ? "Folder restored." : "Folder archived." });
    } catch (caught) {
      setMessage({ ok: false, text: formatApiFailure(caught, "Unable to update folder.") });
    }
  }

  async function publish(document: WorkspaceDocument) {
    if (!accessToken) return;
    try {
      const updated = await publishDocument(accessToken, document.id);
      setDocuments((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setMessage({ ok: true, text: "Document published." });
    } catch (caught) {
      setMessage({ ok: false, text: formatApiFailure(caught, "Unable to publish document.") });
    }
  }

  async function toggleDocumentArchive(document: WorkspaceDocument) {
    if (!accessToken) return;
    const isArchived = document.status === "ARCHIVED" || Boolean(document.archivedAt);
    try {
      const updated = isArchived
        ? await restoreDocument(accessToken, document.id)
        : await archiveDocument(accessToken, document.id);
      setDocuments((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setMessage({ ok: true, text: isArchived ? "Document restored." : "Document archived." });
    } catch (caught) {
      setMessage({ ok: false, text: formatApiFailure(caught, "Unable to update document.") });
    }
  }

  function confirmHardDelete(document: WorkspaceDocument) {
    Alert.alert("Delete permanently?", `This will permanently delete ${document.title} and its versions.`, [
      { style: "cancel", text: "Cancel" },
      {
        onPress: () => void hardDelete(document),
        style: "destructive",
        text: "Delete",
      },
    ]);
  }

  async function hardDelete(document: WorkspaceDocument) {
    if (!accessToken) return;
    try {
      await hardDeleteDocument(accessToken, document.id);
      setDocuments((current) => current.filter((item) => item.id !== document.id));
      if (editor?.document?.id === document.id) setEditor(null);
      setMessage({ ok: true, text: "Document permanently deleted." });
    } catch (caught) {
      setMessage({ ok: false, text: formatApiFailure(caught, "Unable to delete document.") });
    }
  }

  async function restoreVersion(version: DocumentVersion) {
    if (!accessToken || !editor?.document) return;
    try {
      const restored = await restoreDocumentVersion(accessToken, editor.document.id, String(version.version), {
        changeNote: `Restored version ${version.version}`,
      });
      setDocuments((current) => current.map((item) => (item.id === restored.id ? restored : item)));
      setForm(formFromDocument(restored));
      setEditor({ document: restored, mode: "edit" });
      await loadVersions(restored.id);
      setMessage({ ok: true, text: `Version ${version.version} restored.` });
    } catch (caught) {
      setMessage({ ok: false, text: formatApiFailure(caught, "Unable to restore version.") });
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
        style={styles.scroller}
      >
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <Pressable accessibilityRole="button" onPress={() => router.push("/(workspace)")} style={styles.heroIconBtn}>
              <ArrowLeft color={colors.foreground} size={20} strokeWidth={2.8} />
            </Pressable>
            <View style={styles.heroTitleWrap}>
              <Text style={styles.heroEyebrow}>Docs</Text>
              <Text numberOfLines={1} style={styles.heroTitle}>Knowledge base</Text>
              <Text numberOfLines={2} style={styles.heroSub}>Create, publish, organize, and version workspace documents.</Text>
            </View>
            <Pressable accessibilityRole="button" onPress={() => void load(true)} style={styles.heroIconBtn}>
              <RefreshCw color={colors.foreground} size={19} strokeWidth={2.7} />
            </Pressable>
          </View>

          <View style={styles.heroMetrics}>
            <Metric value={metrics.total} label="Docs" />
            <View style={styles.heroDivider} />
            <Metric value={folders.length} label="Folders" />
            <View style={styles.heroDivider} />
            <Metric value={metrics.versionCount} label="Versions" />
          </View>

          <View style={styles.heroActions}>
            <Pressable accessibilityRole="button" onPress={openCreateDocument} style={styles.primaryAction}>
              <Plus color={colors.black} size={17} strokeWidth={2.8} />
              <Text style={styles.primaryActionText}>New document</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => setFolderOpen(true)} style={styles.secondaryAction}>
              <FolderPlus color={colors.foreground} size={17} strokeWidth={2.8} />
              <Text style={styles.secondaryActionText}>Folder</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.body}>
          <View style={styles.searchBar}>
            <Search color={colors.inkSoft} size={18} strokeWidth={2.6} />
            <TextInput
              onChangeText={setSearch}
              placeholder="Search docs, tags, project"
              placeholderTextColor={colors.inkSoft}
              style={styles.searchInput}
              value={search}
            />
            {search ? (
              <Pressable accessibilityRole="button" onPress={() => setSearch("")} style={styles.clearBtn}>
                <X color={colors.inkSoft} size={16} strokeWidth={2.8} />
              </Pressable>
            ) : null}
          </View>

          <ScrollView contentContainerStyle={styles.filterRail} horizontal showsHorizontalScrollIndicator={false}>
            <Chip active={selectedStatus === "ALL"} label="All" onPress={() => setSelectedStatus("ALL")} />
            {statusOptions.map((status) => (
              <Chip active={selectedStatus === status} key={status} label={humanize(status)} onPress={() => setSelectedStatus(status)} />
            ))}
            <Chip active={includeArchived} label="Include archived" onPress={() => setIncludeArchived((value) => !value)} />
          </ScrollView>

          <ScrollView contentContainerStyle={styles.filterRailTight} horizontal showsHorizontalScrollIndicator={false}>
            <FolderChip active={selectedFolderId === "ALL"} count={documents.length} label="All folders" onPress={() => setSelectedFolderId("ALL")} />
            {folders.map((folder) => (
              <FolderChip
                active={selectedFolderId === folder.id}
                archived={Boolean(folder.archivedAt)}
                count={folder._count?.documents ?? 0}
                key={folder.id}
                label={folder.name}
                onLongPress={() => void toggleFolderArchive(folder)}
                onPress={() => setSelectedFolderId(folder.id)}
              />
            ))}
          </ScrollView>

          <ScrollView contentContainerStyle={styles.filterRailTight} horizontal showsHorizontalScrollIndicator={false}>
            <Chip active={selectedVisibility === "ALL"} label="Any visibility" onPress={() => setSelectedVisibility("ALL")} />
            {visibilityOptions.map((visibility) => (
              <Chip active={selectedVisibility === visibility} key={visibility} label={humanize(visibility)} onPress={() => setSelectedVisibility(visibility)} />
            ))}
          </ScrollView>

          {message ? (
            <FeedbackNotice message={message} onDismiss={() => setMessage(null)} />
          ) : null}

          {loading ? (
            <LoadingState />
          ) : error ? (
            <ErrorState error={error} onRetry={() => void load()} />
          ) : (
            <View style={styles.stack}>
              <View style={styles.kpiGrid}>
                <KpiTile icon={<PenLine color={colors.warning} size={18} strokeWidth={2.7} />} label="Draft" tone="yellow" value={metrics.draft} />
                <KpiTile icon={<CheckCircle2 color={colors.success} size={18} strokeWidth={2.7} />} label="Published" tone="green" value={metrics.published} />
                <KpiTile icon={<Archive color={colors.danger} size={18} strokeWidth={2.7} />} label="Archived" tone="red" value={metrics.archived} />
              </View>

              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.sectionTitle}>Documents</Text>
                  <Text style={styles.sectionSub}>{documents.length} matching records</Text>
                </View>
                <Pressable accessibilityRole="button" onPress={openCreateDocument} style={styles.sectionAction}>
                  <Plus color={colors.black} size={16} strokeWidth={2.8} />
                  <Text style={styles.sectionActionText}>New</Text>
                </Pressable>
              </View>

              {documents.length ? documents.map((document) => (
                <DocumentCard
                  document={document}
                  key={document.id}
                  onArchive={() => void toggleDocumentArchive(document)}
                  onDelete={() => confirmHardDelete(document)}
                  onEdit={() => openEditDocument(document)}
                  onPublish={() => void publish(document)}
                />
              )) : <EmptyDocuments onCreate={openCreateDocument} />}
            </View>
          )}
        </View>
      </ScrollView>

      <EditorSheet
        editor={editor}
        folders={folders}
        form={form}
        message={editorMessage}
        onArchive={(document) => void toggleDocumentArchive(document)}
        onChange={setForm}
        onClose={() => setEditor(null)}
        onDelete={confirmHardDelete}
        onDismissMessage={() => setEditorMessage(null)}
        onPublish={(document) => void publish(document)}
        onRestoreVersion={(version) => void restoreVersion(version)}
        onSave={() => void saveDocument()}
        projects={projects}
        saving={saving}
        versions={versions}
        versionsLoading={versionsLoading}
      />

      <FolderSheet
        description={folderDescription}
        message={folderMessage}
        name={folderName}
        onChangeDescription={setFolderDescription}
        onChangeName={setFolderName}
        onClose={() => setFolderOpen(false)}
        onDismissMessage={() => setFolderMessage(null)}
        onSubmit={() => void createFolder()}
        open={folderOpen}
        saving={saving}
      />
    </SafeAreaView>
  );
}

function FeedbackNotice({
  message,
  onDismiss,
  sheet = false,
}: {
  message: NonNullable<FeedbackMessage>;
  onDismiss: () => void;
  sheet?: boolean;
}) {
  const Icon = message.ok ? CheckCircle2 : Shield;
  const color = message.ok ? colors.success : colors.danger;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onDismiss}
      style={[styles.notice, sheet && styles.sheetNotice, message.ok ? styles.noticeOk : styles.noticeBad]}
    >
      <View style={styles.noticeContent}>
        <View style={[styles.noticeIcon, { backgroundColor: `${color}12` }]}>
          <Icon color={color} size={16} strokeWidth={2.7} />
        </View>
        <Text style={[styles.noticeText, message.ok ? styles.noticeTextOk : styles.noticeTextBad]}>{message.text}</Text>
      </View>
      <X color={color} size={15} strokeWidth={2.7} />
    </Pressable>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.heroMetric}>
      <Text style={styles.heroMetricValue}>{value}</Text>
      <Text style={styles.heroMetricLabel}>{label}</Text>
    </View>
  );
}

function DocumentCard({
  document,
  onArchive,
  onDelete,
  onEdit,
  onPublish,
}: {
  document: WorkspaceDocument;
  onArchive: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onPublish: () => void;
}) {
  const archived = document.status === "ARCHIVED" || Boolean(document.archivedAt);

  return (
    <Pressable accessibilityRole="button" onPress={onEdit} style={styles.documentCard}>
      <View style={styles.docTop}>
        <View style={styles.docIcon}>
          {archived ? <FolderArchive color={colors.danger} size={20} strokeWidth={2.7} /> : <FileText color={colors.accent} size={20} strokeWidth={2.7} />}
        </View>
        <View style={styles.docMain}>
          <Text numberOfLines={1} style={styles.docTitle}>{document.title}</Text>
          <Text numberOfLines={1} style={styles.docMeta}>
            {document.documentType} - {document.project?.name ?? "Workspace"} - {formatShortDate(document.updatedAt)}
          </Text>
        </View>
        <ChevronRight color={colors.inkSoft} size={18} strokeWidth={2.7} />
      </View>

      {document.summary ? <Text numberOfLines={2} style={styles.docSummary}>{document.summary}</Text> : null}

      <View style={styles.docFooter}>
        <StatusBadge status={document.status} />
        {document.folder ? <Text numberOfLines={1} style={styles.folderBadge}>{document.folder.name}</Text> : null}
        <Text numberOfLines={1} style={styles.folderBadge}>{humanize(document.visibility)}</Text>
      </View>

      <View style={styles.cardActions}>
        {document.status !== "PUBLISHED" ? (
          <SmallAction icon={<Send color={colors.black} size={14} strokeWidth={2.8} />} label="Publish" onPress={onPublish} primary />
        ) : null}
        <SmallAction icon={<Archive color={colors.foreground} size={14} strokeWidth={2.8} />} label={archived ? "Restore" : "Archive"} onPress={onArchive} />
        {archived ? <SmallAction danger icon={<Trash2 color={colors.danger} size={14} strokeWidth={2.8} />} label="Delete" onPress={onDelete} /> : null}
      </View>
    </Pressable>
  );
}

function EditorSheet({
  editor,
  folders,
  form,
  message,
  onArchive,
  onChange,
  onClose,
  onDelete,
  onDismissMessage,
  onPublish,
  onRestoreVersion,
  onSave,
  projects,
  saving,
  versions,
  versionsLoading,
}: {
  editor: EditorState;
  folders: DocumentFolder[];
  form: DocumentForm;
  message: FeedbackMessage;
  onArchive: (document: WorkspaceDocument) => void;
  onChange: (form: DocumentForm) => void;
  onClose: () => void;
  onDelete: (document: WorkspaceDocument) => void;
  onDismissMessage: () => void;
  onPublish: (document: WorkspaceDocument) => void;
  onRestoreVersion: (version: DocumentVersion) => void;
  onSave: () => void;
  projects: Project[];
  saving: boolean;
  versions: DocumentVersion[];
  versionsLoading: boolean;
}) {
  const open = Boolean(editor);
  const isEdit = editor?.mode === "edit";
  const document = editor?.document ?? null;
  const [sheetTab, setSheetTab] = useState<"form" | "versions">("form");
  const [pickedTemplate, setPickedTemplate] = useState(-1);

  useEffect(() => {
    if (open) {
      setSheetTab("form");
      setPickedTemplate(-1);
    }
  }, [open]);

  function patch(next: Partial<DocumentForm>) {
    onChange({ ...form, ...next });
  }

  function applyTemplate(idx: number) {
    const tpl = DOC_TEMPLATES[idx];
    if (!tpl) return;
    setPickedTemplate(idx);
    patch({ documentType: tpl.type, body: tpl.body });
  }

  const parsedTags = form.tagsText.split(",").map((t) => t.trim()).filter(Boolean);

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={open}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalWrap}>
        <Pressable accessibilityRole="button" onPress={onClose} style={styles.modalScrim} />
        <View style={styles.sheetTall}>
          <View style={styles.sheetGrabber} />

          {/* ── Header ── */}
          <View style={styles.edSheetHeader}>
            <View style={[styles.edModeBadge, { backgroundColor: isEdit ? colors.blueSoft : colors.yellowSoft }]}>
              <Text style={[styles.edModeBadgeText, { color: isEdit ? colors.accent : "#92700a" }]}>
                {isEdit ? "EDITING" : "NEW DOC"}
              </Text>
            </View>
            {isEdit ? (
              <View style={styles.edTabBar}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setSheetTab("form")}
                  style={[styles.edTab, sheetTab === "form" && styles.edTabActive]}
                >
                  <Text style={[styles.edTabText, sheetTab === "form" && styles.edTabTextActive]}>Edit</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setSheetTab("versions")}
                  style={[styles.edTab, sheetTab === "versions" && styles.edTabActive]}
                >
                  <History color={sheetTab === "versions" ? colors.accent : colors.inkSoft} size={13} strokeWidth={2.7} />
                  <Text style={[styles.edTabText, sheetTab === "versions" && styles.edTabTextActive]}>Versions</Text>
                </Pressable>
              </View>
            ) : null}
            <Pressable accessibilityRole="button" onPress={onClose} style={styles.sheetClose}>
              <X color={colors.foreground} size={20} strokeWidth={2.8} />
            </Pressable>
          </View>

          {message ? <FeedbackNotice message={message} onDismiss={onDismissMessage} sheet /> : null}

          {sheetTab === "versions" ? (
            /* ── Versions tab ── */
            <ScrollView contentContainerStyle={styles.editorContent} showsVerticalScrollIndicator={false}>
              <View style={styles.panelTitleRow}>
                <History color={colors.accent} size={18} strokeWidth={2.7} />
                <Text style={styles.versionTitle}>Version history</Text>
              </View>
              {versionsLoading ? (
                <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />
              ) : versions.length ? (
                versions.map((version) => (
                  <View key={version.id} style={styles.versionTimelineRow}>
                    <View style={styles.versionTimelineDot} />
                    <View style={styles.versionTimelineContent}>
                      <View style={styles.versionTimelineHeader}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.versionName}>v{version.version}</Text>
                          <Text style={styles.versionMeta}>{formatShortDate(version.createdAt)}</Text>
                          {version.changeNote ? <Text style={styles.versionNote}>{version.changeNote}</Text> : null}
                        </View>
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => onRestoreVersion(version)}
                          style={styles.restoreChip}
                        >
                          <RotateCcw color={colors.accent} size={12} strokeWidth={2.7} />
                          <Text style={styles.restoreChipText}>Restore</Text>
                        </Pressable>
                      </View>
                    </View>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyInline}>No versions saved yet.</Text>
              )}
            </ScrollView>
          ) : (
            /* ── Form tab ── */
            <ScrollView contentContainerStyle={styles.editorContent} showsVerticalScrollIndicator={false}>

              {/* Template picker — create mode only */}
              {!isEdit ? (
                <View style={styles.edSection}>
                  <Text style={styles.edSectionTitle}>Start from a template</Text>
                  <ScrollView contentContainerStyle={styles.templateRail} horizontal showsHorizontalScrollIndicator={false}>
                    {DOC_TEMPLATES.map((tpl, idx) => (
                      <TemplateCard
                        bg={tpl.bg}
                        color={tpl.color}
                        icon={tpl.icon}
                        key={tpl.type}
                        label={tpl.label}
                        onPress={() => applyTemplate(idx)}
                        selected={pickedTemplate === idx}
                      />
                    ))}
                  </ScrollView>
                </View>
              ) : null}

              {/* Title & summary */}
              <View style={styles.edTitleSection}>
                <TextInput
                  autoCapitalize="sentences"
                  multiline
                  onChangeText={(title) => patch({ title })}
                  placeholder="Document title..."
                  placeholderTextColor={colors.line}
                  style={styles.docTitleInput}
                  value={form.title}
                />
                <View style={styles.edTitleDivider} />
                <TextInput
                  onChangeText={(summary) => patch({ summary })}
                  placeholder="Short description or purpose..."
                  placeholderTextColor={colors.inkSoft}
                  style={styles.docSummaryInput}
                  value={form.summary}
                />
              </View>

              {/* Document type */}
              <View style={styles.edSection}>
                <Text style={styles.edSectionTitle}>Document type</Text>
                <View style={styles.docTypeGrid}>
                  {DOC_TEMPLATES.map((tpl) => {
                    const TypeIcon = tpl.icon;
                    const active = form.documentType === tpl.type;
                    return (
                      <Pressable
                        accessibilityRole="button"
                        key={tpl.type}
                        onPress={() => patch({ documentType: tpl.type })}
                        style={[styles.docTypeTile, active && { backgroundColor: tpl.bg, borderColor: tpl.color + "66" }]}
                      >
                        <TypeIcon color={active ? tpl.color : colors.inkSoft} size={15} strokeWidth={2.5} />
                        <Text style={[styles.docTypeTileText, active && { color: tpl.color }]}>{tpl.label}</Text>
                        {active ? <CheckCircle2 color={tpl.color} size={13} strokeWidth={2.7} style={{ marginLeft: "auto" }} /> : null}
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Status */}
              <View style={styles.edSection}>
                <Text style={styles.edSectionTitle}>Status</Text>
                <View style={styles.statusRow}>
                  {STATUS_OPTS.map((opt) => {
                    const StatusIcon = opt.icon;
                    const active = form.status === opt.value;
                    return (
                      <Pressable
                        accessibilityRole="button"
                        key={opt.value}
                        onPress={() => patch({ status: opt.value })}
                        style={[styles.statusPill, active && { backgroundColor: opt.bg, borderColor: opt.color + "55" }]}
                      >
                        <StatusIcon color={active ? opt.color : colors.inkSoft} size={14} strokeWidth={2.5} />
                        <Text style={[styles.statusPillText, active && { color: opt.color }]}>{opt.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Visibility */}
              <View style={styles.edSection}>
                <Text style={styles.edSectionTitle}>Visibility</Text>
                <ScrollView contentContainerStyle={styles.visRail} horizontal showsHorizontalScrollIndicator={false}>
                  {VISIBILITY_OPTS.map((opt) => {
                    const VisIcon = opt.icon;
                    const active = form.visibility === opt.value;
                    return (
                      <Pressable
                        accessibilityRole="button"
                        key={opt.value}
                        onPress={() => patch({ visibility: opt.value })}
                        style={[styles.visPill, active && styles.visPillActive]}
                      >
                        <VisIcon color={active ? colors.white : colors.inkSoft} size={14} strokeWidth={2.5} />
                        <View>
                          <Text style={[styles.visPillLabel, active && styles.visPillLabelActive]}>{opt.label}</Text>
                          <Text style={[styles.visPillSub, active && styles.visPillSubActive]}>{opt.sub}</Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Project */}
              <View style={styles.edSection}>
                <Text style={styles.edSectionTitle}>Project</Text>
                <ScrollView contentContainerStyle={styles.typeRail} horizontal showsHorizontalScrollIndicator={false}>
                  <Chip active={!form.projectId} label="Workspace" onPress={() => patch({ projectId: "" })} />
                  {projects.map((project) => (
                    <Chip
                      active={form.projectId === project.id}
                      key={project.id}
                      label={project.key || project.name}
                      onPress={() => patch({ projectId: project.id })}
                    />
                  ))}
                </ScrollView>
              </View>

              {/* Folder */}
              <View style={styles.edSection}>
                <Text style={styles.edSectionTitle}>Folder</Text>
                <ScrollView contentContainerStyle={styles.typeRail} horizontal showsHorizontalScrollIndicator={false}>
                  <Chip active={!form.folderId} label="No folder" onPress={() => patch({ folderId: "" })} />
                  {folders.map((folder) => (
                    <Chip
                      active={form.folderId === folder.id}
                      key={folder.id}
                      label={folder.name}
                      onPress={() => patch({ folderId: folder.id })}
                    />
                  ))}
                </ScrollView>
              </View>

              {/* Content / body */}
              <View style={styles.edSection}>
                <Text style={styles.edSectionTitle}>Content</Text>
                <View style={styles.bodyWrap}>
                  <View style={styles.mdHintsBarOuter}>
                    <ScrollView contentContainerStyle={styles.mdHintsBar} horizontal showsHorizontalScrollIndicator={false}>
                      {["# H1", "## H2", "**bold**", "_italic_", "- Item", "`code`"].map((hint) => (
                        <Pressable
                          accessibilityRole="button"
                          key={hint}
                          onPress={() =>
                            patch({
                              body: form.body + (form.body.length > 0 && !form.body.endsWith("\n") ? "\n" : "") + hint,
                            })
                          }
                          style={styles.mdHint}
                        >
                          <Text style={styles.mdHintText}>{hint}</Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>
                  <TextInput
                    multiline
                    onChangeText={(body) => patch({ body })}
                    placeholder={"# Start writing...\n\nSupports markdown formatting."}
                    placeholderTextColor={colors.inkSoft}
                    style={styles.bodyInput}
                    textAlignVertical="top"
                    value={form.body}
                  />
                </View>
              </View>

              {/* Tags */}
              <View style={styles.edSection}>
                <Text style={styles.edSectionTitle}>Tags</Text>
                <TextInput
                  onChangeText={(tagsText) => patch({ tagsText })}
                  placeholder="runbook, ops, client (comma separated)"
                  placeholderTextColor={colors.inkSoft}
                  style={styles.inlineInput}
                  value={form.tagsText}
                />
                {parsedTags.length > 0 ? (
                  <View style={styles.tagPills}>
                    {parsedTags.map((tag) => (
                      <View key={tag} style={styles.tagPill}>
                        <Text style={styles.tagPillText}>{tag}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>

              {/* Advanced */}
              <View style={styles.edSection}>
                <Text style={styles.edSectionTitle}>Advanced</Text>
                <TextInput
                  onChangeText={(slug) => patch({ slug })}
                  placeholder="custom-url-slug (optional)"
                  placeholderTextColor={colors.inkSoft}
                  style={[styles.inlineInput, { marginBottom: 10 }]}
                  value={form.slug}
                />
                <TextInput
                  onChangeText={(changeNote) => patch({ changeNote })}
                  placeholder="What changed in this version?"
                  placeholderTextColor={colors.inkSoft}
                  style={styles.inlineInput}
                  value={form.changeNote}
                />
              </View>
            </ScrollView>
          )}

          {/* ── Footer ── */}
          <View style={styles.sheetFooter}>
            {document ? (
              <View style={styles.footerActions}>
                {document.status !== "PUBLISHED" ? (
                  <Pressable accessibilityRole="button" onPress={() => onPublish(document)} style={styles.footerSmallBtn}>
                    <Send color={colors.foreground} size={16} strokeWidth={2.8} />
                  </Pressable>
                ) : null}
                <Pressable accessibilityRole="button" onPress={() => onArchive(document)} style={styles.footerSmallBtn}>
                  <Archive color={colors.foreground} size={16} strokeWidth={2.8} />
                </Pressable>
                {document.status === "ARCHIVED" || document.archivedAt ? (
                  <Pressable accessibilityRole="button" onPress={() => onDelete(document)} style={styles.footerSmallBtn}>
                    <Trash2 color={colors.danger} size={16} strokeWidth={2.8} />
                  </Pressable>
                ) : null}
              </View>
            ) : null}
            <Pressable
              accessibilityRole="button"
              disabled={saving || !form.title.trim()}
              onPress={onSave}
              style={[styles.saveBtn, (!form.title.trim() || saving) && styles.disabledBtn]}
            >
              {saving ? <ActivityIndicator color={colors.black} size="small" /> : <Save color={colors.black} size={18} strokeWidth={2.8} />}
              <Text style={styles.saveBtnText}>{isEdit ? "Save changes" : "Create document"}</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function TemplateCard({
  bg,
  color,
  icon: Icon,
  label,
  onPress,
  selected,
}: {
  bg: string;
  color: string;
  icon: DocIcon;
  label: string;
  onPress: () => void;
  selected: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[
        styles.templateCard,
        { backgroundColor: selected ? bg : colors.white, borderColor: selected ? color + "66" : colors.line },
      ]}
    >
      <View style={[styles.templateCardIcon, { backgroundColor: selected ? color : colors.panelMuted }]}>
        <Icon color={selected ? colors.white : colors.inkSoft} size={18} strokeWidth={2.5} />
      </View>
      <Text style={[styles.templateCardLabel, { color: selected ? color : colors.foreground }]}>{label}</Text>
      {selected ? (
        <View style={styles.templateCardCheck}>
          <CheckCircle2 color={color} size={13} strokeWidth={2.7} />
        </View>
      ) : null}
    </Pressable>
  );
}

function FolderSheet({
  description,
  message,
  name,
  onChangeDescription,
  onChangeName,
  onClose,
  onDismissMessage,
  onSubmit,
  open,
  saving,
}: {
  description: string;
  message: FeedbackMessage;
  name: string;
  onChangeDescription: (value: string) => void;
  onChangeName: (value: string) => void;
  onClose: () => void;
  onDismissMessage: () => void;
  onSubmit: () => void;
  open: boolean;
  saving: boolean;
}) {
  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={open}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalWrap}>
        <Pressable accessibilityRole="button" onPress={onClose} style={styles.modalScrim} />
        <View style={styles.sheet}>
          <View style={styles.sheetGrabber} />
          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.sheetEyebrow}>NEW FOLDER</Text>
              <Text style={styles.sheetTitle}>Create folder</Text>
            </View>
            <Pressable accessibilityRole="button" onPress={onClose} style={styles.sheetClose}>
              <X color={colors.foreground} size={20} strokeWidth={2.8} />
            </Pressable>
          </View>
          {message ? <FeedbackNotice message={message} onDismiss={onDismissMessage} sheet /> : null}
          <LabeledInput label="Folder name" onChangeText={onChangeName} placeholder="Client delivery" value={name} />
          <LabeledInput label="Description" onChangeText={onChangeDescription} placeholder="What belongs here?" value={description} />
          <Pressable accessibilityRole="button" disabled={saving || !name.trim()} onPress={onSubmit} style={[styles.saveBtn, (!name.trim() || saving) && styles.disabledBtn]}>
            {saving ? <ActivityIndicator color={colors.black} size="small" /> : <FolderPlus color={colors.black} size={18} strokeWidth={2.8} />}
            <Text style={styles.saveBtnText}>Create folder</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function KpiTile({
  icon,
  label,
  tone,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  tone: "green" | "red" | "yellow";
  value: number;
}) {
  return (
    <View style={[styles.kpiTile, { backgroundColor: toneSoft(tone) }]}>
      {icon}
      <Text style={styles.kpiValue}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

function SmallAction({
  danger,
  icon,
  label,
  onPress,
  primary,
}: {
  danger?: boolean;
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  primary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.smallAction, primary && styles.smallActionPrimary, danger && styles.smallActionDanger]}
    >
      {icon}
      <Text style={[styles.smallActionText, primary && styles.smallActionTextPrimary, danger && styles.smallActionTextDanger]}>{label}</Text>
    </Pressable>
  );
}

function Chip({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text numberOfLines={1} style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function FolderChip({
  active,
  archived,
  count,
  label,
  onLongPress,
  onPress,
}: {
  active: boolean;
  archived?: boolean;
  count: number;
  label: string;
  onLongPress?: () => void;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" onLongPress={onLongPress} onPress={onPress} style={[styles.folderChip, active && styles.folderChipActive]}>
      {archived ? <FolderArchive color={active ? colors.white : colors.danger} size={15} strokeWidth={2.7} /> : <Folder color={active ? colors.white : colors.primaryDark} size={15} strokeWidth={2.7} />}
      <Text numberOfLines={1} style={[styles.folderChipText, active && styles.folderChipTextActive]}>{label}</Text>
      <Text style={[styles.folderCount, active && styles.folderCountActive]}>{count}</Text>
    </Pressable>
  );
}

function StatusBadge({ status }: { status: DocumentStatus }) {
  const color = status === "PUBLISHED" ? colors.success : status === "ARCHIVED" ? colors.danger : colors.warning;
  const bg = status === "PUBLISHED" ? colors.greenSoft : status === "ARCHIVED" ? colors.redSoft : colors.yellowSoft;
  return (
    <View style={[styles.statusBadge, { backgroundColor: bg }]}>
      <Text style={[styles.statusBadgeText, { color }]}>{humanize(status)}</Text>
    </View>
  );
}

function LabeledInput({
  label,
  multiline,
  onChangeText,
  placeholder,
  value,
}: {
  label: string;
  multiline?: boolean;
  onChangeText: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  return (
    <View style={styles.inputGroup}>
      <FieldLabel label={label} />
      <TextInput
        multiline={multiline}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#aaa49d"
        style={[styles.input, multiline && styles.textarea]}
        textAlignVertical={multiline ? "top" : "center"}
        value={value}
      />
    </View>
  );
}

function FieldLabel({ label }: { label: string }) {
  return <Text style={styles.fieldLabel}>{label}</Text>;
}

function LoadingState() {
  return (
    <View style={styles.stateBox}>
      <ActivityIndicator color={colors.accent} size="large" />
      <Text style={styles.stateTitle}>Loading docs</Text>
      <Text style={styles.stateText}>Fetching folders, documents, and workspace links.</Text>
    </View>
  );
}

function ErrorState({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <View style={styles.errorBox}>
      <Text style={styles.errorTitle}>Docs unavailable</Text>
      <Text style={styles.errorText}>{error}</Text>
      <Pressable accessibilityRole="button" onPress={onRetry} style={styles.retryBtn}>
        <Text style={styles.retryText}>Try again</Text>
      </Pressable>
    </View>
  );
}

function EmptyDocuments({ onCreate }: { onCreate: () => void }) {
  return (
    <View style={styles.emptyBox}>
      <BookOpenText color={colors.accent} size={32} strokeWidth={2.5} />
      <Text style={styles.emptyTitle}>No documents yet</Text>
      <Text style={styles.emptyText}>Create project plans, runbooks, decisions, policies, and meeting notes.</Text>
      <Pressable accessibilityRole="button" onPress={onCreate} style={styles.emptyBtn}>
        <Plus color={colors.black} size={17} strokeWidth={2.8} />
        <Text style={styles.emptyBtnText}>New document</Text>
      </Pressable>
    </View>
  );
}

function formFromDocument(document: WorkspaceDocument): DocumentForm {
  return {
    body: document.body ?? "",
    changeNote: "",
    documentType: document.documentType || "GENERAL",
    folderId: document.folderId ?? "",
    projectId: document.projectId ?? "",
    slug: document.slug ?? "",
    status: document.status,
    summary: document.summary ?? "",
    tagsText: (document.tags ?? []).join(", "),
    title: document.title,
    visibility: document.visibility,
  };
}

function formToPayload(form: DocumentForm): CreateDocumentPayload | UpdateDocumentPayload {
  return {
    body: form.body || undefined,
    changeNote: form.changeNote || undefined,
    documentType: form.documentType || "GENERAL",
    folderId: form.folderId || undefined,
    projectId: form.projectId || undefined,
    slug: form.slug.trim() || undefined,
    status: form.status,
    summary: form.summary.trim() || undefined,
    tags: form.tagsText.split(",").map((tag) => tag.trim()).filter(Boolean),
    title: form.title.trim(),
    visibility: form.visibility,
  };
}

function formatShortDate(value?: string | null) {
  if (!value) return "No date";
  return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" }).format(new Date(value));
}

function humanize(value: string) {
  return value.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function toneSoft(tone: "green" | "red" | "yellow") {
  if (tone === "green") return colors.greenSoft;
  if (tone === "red") return colors.redSoft;
  return colors.yellowSoft;
}

function formatApiFailure(caught: unknown, fallback: string) {
  if (caught instanceof ApiError) {
    const requestHint = caught.requestId ? ` Request ID: ${caught.requestId}` : "";
    if (caught.status === 401) {
      return `Your session is not authorized for this action. Sign in again, or ask an admin to enable document access.${requestHint}`;
    }
    if (caught.status === 403) {
      return `You do not have permission to manage workspace documents. Ask an admin for document permissions.${requestHint}`;
    }
    if (caught.status === 400 || caught.status === 422) {
      return `${caught.message || "Some document fields need attention."}${requestHint}`;
    }
    return `${caught.message || fallback}${requestHint}`;
  }

  return caught instanceof Error ? caught.message : fallback;
}

const styles = StyleSheet.create(withFontStyles({
  safe: {
    backgroundColor: colors.background,
    flex: 1,
  },
  scroller: {
    backgroundColor: colors.background,
  },
  content: {
    paddingBottom: 146,
  },
  hero: {
    backgroundColor: colors.background,
    paddingBottom: 16,
    paddingHorizontal: 24,
    paddingTop: 22,
  },
  heroTop: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 14,
  },
  heroIconBtn: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: 17,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    width: 44,
    ...shadow.card,
  },
  heroTitleWrap: {
    flex: 1,
    gap: 4,
    paddingTop: 1,
  },
  heroEyebrow: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  heroTitle: {
    color: colors.foreground,
    fontSize: 26,
    fontWeight: "900",
  },
  heroSub: {
    color: colors.inkSoft,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
  },
  heroMetrics: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: "row",
    marginTop: 22,
    paddingHorizontal: 20,
    paddingVertical: 18,
    ...shadow.card,
  },
  heroMetric: {
    alignItems: "center",
    flex: 1,
  },
  heroMetricValue: {
    color: colors.foreground,
    fontSize: 23,
    fontWeight: "900",
  },
  heroMetricLabel: {
    color: colors.inkSoft,
    fontSize: 10,
    fontWeight: "900",
    marginTop: 4,
    textTransform: "uppercase",
  },
  heroDivider: {
    backgroundColor: colors.line,
    height: 34,
    width: 1,
  },
  heroActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 22,
  },
  primaryAction: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 18,
    flexDirection: "row",
    gap: 8,
    minHeight: 50,
    paddingHorizontal: 20,
  },
  primaryActionText: {
    color: colors.black,
    fontSize: 14,
    fontWeight: "900",
  },
  secondaryAction: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 18,
    flexDirection: "row",
    gap: 8,
    minHeight: 50,
    paddingHorizontal: 20,
  },
  secondaryActionText: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: "900",
  },
  body: {
    gap: 16,
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  searchBar: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: 62,
    paddingHorizontal: 20,
    ...shadow.card,
  },
  searchInput: {
    color: colors.foreground,
    flex: 1,
    fontSize: 15,
    fontWeight: "800",
  },
  clearBtn: {
    padding: 4,
  },
  filterRail: {
    gap: 10,
    paddingBottom: 4,
    paddingTop: 2,
  },
  filterRailTight: {
    gap: 10,
    paddingBottom: 2,
  },
  chip: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 40,
    paddingHorizontal: 17,
  },
  chipActive: {
    backgroundColor: colors.black,
    borderColor: colors.black,
  },
  chipText: {
    color: colors.inkSoft,
    fontSize: 13,
    fontWeight: "900",
  },
  chipTextActive: {
    color: colors.white,
  },
  folderChip: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    maxWidth: 190,
    minHeight: 46,
    paddingHorizontal: 14,
  },
  folderChipActive: {
    backgroundColor: colors.black,
    borderColor: colors.black,
  },
  folderChipText: {
    color: colors.foreground,
    flexShrink: 1,
    fontSize: 13,
    fontWeight: "900",
  },
  folderChipTextActive: {
    color: colors.white,
  },
  folderCount: {
    color: colors.inkSoft,
    fontSize: 12,
    fontWeight: "900",
  },
  folderCountActive: {
    color: colors.primary,
  },
  notice: {
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  sheetNotice: {
    marginHorizontal: 18,
    marginTop: 8,
  },
  noticeOk: {
    backgroundColor: colors.greenSoft,
    borderColor: "#bbf7d0",
  },
  noticeBad: {
    backgroundColor: colors.redSoft,
    borderColor: "#fecaca",
  },
  noticeText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 18,
  },
  noticeContent: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: 10,
    minWidth: 0,
  },
  noticeIcon: {
    alignItems: "center",
    borderRadius: 12,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  noticeTextOk: {
    color: colors.success,
  },
  noticeTextBad: {
    color: colors.danger,
  },
  stack: {
    gap: 20,
  },
  kpiGrid: {
    flexDirection: "row",
    gap: 12,
  },
  kpiTile: {
    borderColor: "rgba(0,0,0,0.04)",
    borderRadius: 24,
    borderWidth: 1,
    flex: 1,
    minHeight: 112,
    padding: 17,
  },
  kpiValue: {
    color: colors.foreground,
    fontSize: 24,
    fontWeight: "900",
    marginTop: 10,
  },
  kpiLabel: {
    color: colors.inkSoft,
    fontSize: 11,
    fontWeight: "900",
    marginTop: 4,
    textTransform: "uppercase",
  },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 2,
  },
  sectionTitle: {
    color: colors.foreground,
    fontSize: 22,
    fontWeight: "900",
  },
  sectionSub: {
    color: colors.inkSoft,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 3,
  },
  sectionAction: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 18,
    flexDirection: "row",
    gap: 6,
    minHeight: 46,
    paddingHorizontal: 16,
  },
  sectionActionText: {
    color: colors.black,
    fontSize: 13,
    fontWeight: "900",
  },
  documentCard: {
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
    ...shadow.card,
  },
  docTop: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  docIcon: {
    alignItems: "center",
    backgroundColor: colors.blueSoft,
    borderRadius: 17,
    height: 50,
    justifyContent: "center",
    width: 50,
  },
  docMain: {
    flex: 1,
  },
  docTitle: {
    color: colors.foreground,
    fontSize: 17,
    fontWeight: "900",
  },
  docMeta: {
    color: colors.inkSoft,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 3,
  },
  docSummary: {
    color: colors.inkSoft,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 19,
    marginTop: 14,
  },
  docFooter: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  folderBadge: {
    backgroundColor: colors.panelMuted,
    borderRadius: 999,
    color: colors.inkSoft,
    fontSize: 10,
    fontWeight: "900",
    maxWidth: 170,
    paddingHorizontal: 10,
    paddingVertical: 6,
    textTransform: "uppercase",
  },
  cardActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
  },
  smallAction: {
    alignItems: "center",
    backgroundColor: colors.panelMuted,
    borderRadius: 14,
    flexDirection: "row",
    gap: 6,
    minHeight: 36,
    paddingHorizontal: 11,
  },
  smallActionPrimary: {
    backgroundColor: colors.primary,
  },
  smallActionDanger: {
    backgroundColor: colors.redSoft,
  },
  smallActionText: {
    color: colors.foreground,
    fontSize: 12,
    fontWeight: "900",
  },
  smallActionTextPrimary: {
    color: colors.black,
  },
  smallActionTextDanger: {
    color: colors.danger,
  },
  modalWrap: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.42)",
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingBottom: 28,
    paddingHorizontal: 22,
    paddingTop: 10,
  },
  sheetTall: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    maxHeight: "92%",
    paddingBottom: 18,
    paddingHorizontal: 22,
    paddingTop: 10,
  },
  sheetGrabber: {
    alignSelf: "center",
    backgroundColor: colors.line,
    borderRadius: 999,
    height: 4,
    marginBottom: 18,
    width: 44,
  },
  sheetHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  sheetEyebrow: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: "900",
  },
  sheetTitle: {
    color: colors.foreground,
    fontSize: 26,
    fontWeight: "900",
    marginTop: 2,
  },
  sheetClose: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: 18,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  editorContent: {
    paddingBottom: 18,
  },
  inputGroup: {
    marginBottom: 14,
  },
  fieldLabel: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: "900",
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    color: colors.foreground,
    fontSize: 15,
    fontWeight: "800",
    minHeight: 54,
    paddingHorizontal: 16,
  },
  textarea: {
    minHeight: 190,
    paddingTop: 14,
  },
  typeRail: {
    gap: 8,
    paddingBottom: 14,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 14,
  },
  versionPanel: {
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: 22,
    borderWidth: 1,
    marginBottom: 14,
    padding: 14,
  },
  panelTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  versionTitle: {
    color: colors.foreground,
    fontSize: 16,
    fontWeight: "900",
  },
  versionRow: {
    alignItems: "center",
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 10,
    paddingVertical: 10,
  },
  versionMain: {
    flex: 1,
  },
  versionName: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: "900",
  },
  versionMeta: {
    color: colors.inkSoft,
    fontSize: 11,
    fontWeight: "800",
    marginTop: 2,
  },
  restoreBtn: {
    alignItems: "center",
    backgroundColor: colors.blueSoft,
    borderRadius: 14,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  emptyInline: {
    color: colors.inkSoft,
    fontSize: 13,
    fontWeight: "800",
  },
  sheetFooter: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    paddingTop: 10,
  },
  footerActions: {
    flexDirection: "row",
    gap: 8,
  },
  footerSmallBtn: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: 17,
    borderWidth: 1,
    height: 50,
    justifyContent: "center",
    width: 50,
  },
  saveBtn: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 20,
    flex: 1,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    minHeight: 54,
  },
  saveBtnText: {
    color: colors.black,
    fontSize: 15,
    fontWeight: "900",
  },
  disabledBtn: {
    opacity: 0.45,
  },
  stateBox: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: 24,
    gap: 8,
    padding: 30,
    ...shadow.card,
  },
  stateTitle: {
    color: colors.foreground,
    fontSize: 18,
    fontWeight: "900",
    marginTop: 6,
  },
  stateText: {
    color: colors.inkSoft,
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center",
  },
  errorBox: {
    backgroundColor: colors.redSoft,
    borderColor: "#fecaca",
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
  },
  errorTitle: {
    color: colors.danger,
    fontSize: 18,
    fontWeight: "900",
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: "800",
    marginTop: 6,
  },
  retryBtn: {
    alignSelf: "flex-start",
    backgroundColor: colors.danger,
    borderRadius: 14,
    marginTop: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  retryText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: "900",
  },
  emptyBox: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: 24,
    borderWidth: 1,
    padding: 28,
    ...shadow.card,
  },
  emptyTitle: {
    color: colors.foreground,
    fontSize: 18,
    fontWeight: "900",
    marginTop: 12,
  },
  emptyText: {
    color: colors.inkSoft,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 19,
    marginTop: 5,
    textAlign: "center",
  },
  emptyBtn: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 17,
    flexDirection: "row",
    gap: 7,
    marginTop: 16,
    minHeight: 44,
    paddingHorizontal: 15,
  },
  emptyBtnText: {
    color: colors.black,
    fontSize: 13,
    fontWeight: "900",
  },

  // ── Editor sheet redesign ──
  edSheetHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  edModeBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  edModeBadgeText: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  edTabBar: {
    backgroundColor: colors.panelMuted,
    borderRadius: 18,
    flex: 1,
    flexDirection: "row",
    gap: 2,
    padding: 3,
  },
  edTab: {
    alignItems: "center",
    borderRadius: 14,
    flex: 1,
    flexDirection: "row",
    gap: 5,
    justifyContent: "center",
    paddingVertical: 7,
  },
  edTabActive: {
    backgroundColor: colors.white,
  },
  edTabText: {
    color: colors.inkSoft,
    fontSize: 13,
    fontWeight: "900",
  },
  edTabTextActive: {
    color: colors.foreground,
  },
  edSection: {
    marginBottom: 20,
  },
  edSectionTitle: {
    color: colors.inkSoft,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.8,
    marginBottom: 10,
    textTransform: "uppercase",
  },
  edTitleSection: {
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: 20,
    borderWidth: 1.5,
    marginBottom: 20,
    padding: 16,
  },
  edTitleDivider: {
    backgroundColor: colors.line,
    height: 1,
    marginVertical: 12,
  },
  docTitleInput: {
    color: colors.foreground,
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: -0.5,
    minHeight: 32,
  },
  docSummaryInput: {
    color: colors.inkSoft,
    fontSize: 14,
    fontWeight: "700",
    minHeight: 28,
  },
  templateRail: {
    gap: 10,
    paddingBottom: 4,
  },
  templateCard: {
    alignItems: "center",
    borderRadius: 18,
    borderWidth: 1.5,
    gap: 8,
    padding: 12,
    position: "relative",
    width: 84,
  },
  templateCardIcon: {
    alignItems: "center",
    borderRadius: 12,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  templateCardLabel: {
    fontSize: 11,
    fontWeight: "900",
    textAlign: "center",
  },
  templateCardCheck: {
    position: "absolute",
    right: 6,
    top: 6,
  },
  docTypeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  docTypeTile: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 7,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  docTypeTileText: {
    color: colors.inkSoft,
    fontSize: 12,
    fontWeight: "900",
  },
  statusRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  statusPill: {
    alignItems: "center",
    backgroundColor: colors.panelMuted,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  statusPillText: {
    color: colors.inkSoft,
    fontSize: 13,
    fontWeight: "900",
  },
  visRail: {
    gap: 8,
    paddingBottom: 2,
  },
  visPill: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    gap: 9,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  visPillActive: {
    backgroundColor: colors.foreground,
    borderColor: colors.foreground,
  },
  visPillLabel: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: "900",
  },
  visPillLabelActive: {
    color: colors.white,
  },
  visPillSub: {
    color: colors.inkSoft,
    fontSize: 10,
    fontWeight: "800",
    marginTop: 1,
  },
  visPillSubActive: {
    color: "rgba(255,255,255,0.55)",
  },
  bodyWrap: {
    borderColor: colors.line,
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  mdHintsBarOuter: {
    backgroundColor: colors.panelMuted,
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
  },
  mdHintsBar: {
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  mdHint: {
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  mdHintText: {
    color: colors.foreground,
    fontSize: 11,
    fontWeight: "900",
  },
  bodyInput: {
    backgroundColor: colors.white,
    color: colors.foreground,
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 22,
    minHeight: 200,
    padding: 14,
  },
  inlineInput: {
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: 14,
    borderWidth: 1,
    color: colors.foreground,
    fontSize: 14,
    fontWeight: "800",
    minHeight: 48,
    paddingHorizontal: 14,
  },
  tagPills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 10,
  },
  tagPill: {
    backgroundColor: colors.blueSoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  tagPillText: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: "900",
  },
  versionTimelineRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12,
    paddingVertical: 10,
  },
  versionTimelineDot: {
    backgroundColor: colors.accent,
    borderRadius: 5,
    height: 10,
    marginTop: 4,
    width: 10,
  },
  versionTimelineContent: {
    flex: 1,
  },
  versionTimelineHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 8,
  },
  restoreChip: {
    alignItems: "center",
    backgroundColor: colors.blueSoft,
    borderRadius: 999,
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  restoreChipText: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: "900",
  },
  versionNote: {
    color: colors.inkSoft,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 2,
  },
}));
