import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import * as DocumentPicker from "expo-document-picker";
import {
  ActivityIndicator,
  Alert,
  Image,
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
  ArrowLeft,
  BookOpen,
  Building2,
  ImagePlus,
  Mail,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UserPlus,
  UsersRound,
  X,
} from "lucide-react-native";
import {
  addTeamMember,
  bulkInviteTenantUsers,
  cancelTeamMemberInvite,
  createFileAsset,
  createTeam,
  createUploadIntent,
  deleteTeam,
  inviteTeamMember,
  inviteTenantUser,
  listPermissions,
  listRoles,
  listTeamMembers,
  listTeams,
  listUsers,
  listWorkspaces,
  removeTeamMember,
  resendTeamMemberInvite,
  updateTeam,
  type TeamInviteResult,
} from "@/lib/api";
import { useAuthSession } from "@/lib/auth/AuthSessionProvider";
import { withFontStyles } from "@/lib/theme/fontDefaults";
import { colors, radii, shadow } from "@/lib/theme/tokens";
import type { BulkInviteUsersResponse, Permission, Role, Team, TeamMember, TenantUser, UploadIntent, Workspace } from "@/lib/types";

type TeamTab = "members" | "invite" | "add" | "directory" | "bulk" | "roles";
type TeamFormState = {
  avatarPublicId: string;
  avatarUrl: string;
  description: string;
  name: string;
  workspaceId: string;
};
type PickedTeamAsset = {
  mimeType?: string | null;
  name: string;
  size?: number | null;
  uri: string;
};

const teamRoleOptions = ["Owner", "Lead", "Manager", "Member", "Viewer"];
const teamAccents = ["#2563eb", "#0f9f6e", "#8b5cf6", "#dc2626", "#0ea5e9", "#b45309", "#db2777"];

export function TeamManagementScreen() {
  const { accessToken } = useAuthSession();
  const [activeTab, setActiveTab] = useState<TeamTab>("members");
  const [addForm, setAddForm] = useState({ role: "Member", userId: "" });
  const [bulkResult, setBulkResult] = useState<BulkInviteUsersResponse | null>(null);
  const [bulkRoleIds, setBulkRoleIds] = useState<string[]>([]);
  const [bulkText, setBulkText] = useState("");
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [error, setError] = useState("");
  const [inviteForm, setInviteForm] = useState({ email: "", firstName: "", lastName: "", roleIds: [] as string[], teamRole: "Member" });
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [query, setQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [roles, setRoles] = useState<Role[]>([]);
  const [saving, setSaving] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [teamForm, setTeamForm] = useState<TeamFormState>({ avatarPublicId: "", avatarUrl: "", description: "", name: "", workspaceId: "" });
  const [teams, setTeams] = useState<Team[]>([]);
  const [tenantInviteForm, setTenantInviteForm] = useState({ email: "", firstName: "", lastName: "", roleIds: [] as string[] });
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);

  const selectedTeam = useMemo(() => teams.find((team) => team.id === selectedTeamId) ?? teams[0] ?? null, [selectedTeamId, teams]);
  const filteredTeams = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) return teams;
    return teams.filter((team) => [team.name, team.description, team.workspace?.name].filter(Boolean).some((value) => String(value).toLowerCase().includes(text)));
  }, [query, teams]);
  const memberUserIds = useMemo(() => new Set(members.map((member) => member.userId)), [members]);
  const addableUsers = useMemo(() => users.filter((user) => !memberUserIds.has(user.id)), [memberUserIds, users]);
  const activeMembers = members.filter((member) => member.user.status === "ACTIVE").length;
  const invitedMembers = members.filter((member) => member.user.status === "INVITED").length;
  const uniquePerms = useMemo(() => {
    const keys = new Set<string>();
    members.forEach((member) => memberPermissionLabels(member).forEach((label) => keys.add(label)));
    return keys.size;
  }, [members]);

  const loadDirectory = useCallback(async (showRefreshing = false) => {
    if (!accessToken) return;
    if (showRefreshing) setRefreshing(true);
    else setLoading(true);
    setError("");
    setMessage(null);
    try {
      const [teamPage, userPage, roleList, permissionList, workspacePage] = await Promise.all([
        listTeams(accessToken, { limit: 100 }),
        listUsers(accessToken, { limit: 100 }),
        listRoles(accessToken),
        listPermissions(accessToken),
        listWorkspaces(accessToken, { limit: 100 }),
      ]);
      const nextTeams = Array.isArray(teamPage) ? teamPage : teamPage.data;
      const nextWorkspaces = Array.isArray(workspacePage) ? workspacePage : workspacePage.data;
      setTeams(nextTeams);
      setUsers(Array.isArray(userPage) ? userPage : userPage.data);
      setRoles(roleList);
      setPermissions(permissionList);
      setWorkspaces(nextWorkspaces);
      setTeamForm((current) => ({ ...current, workspaceId: current.workspaceId || nextWorkspaces[0]?.id || "" }));
      setSelectedTeamId((current) => current || nextTeams[0]?.id || "");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load team data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [accessToken]);

  const loadMembers = useCallback(async (teamId = selectedTeamId) => {
    if (!accessToken || !teamId) {
      setMembers([]);
      return;
    }
    setMembersLoading(true);
    try {
      setMembers(await listTeamMembers(accessToken, teamId));
    } catch (caught) {
      setMessage({ ok: false, text: caught instanceof Error ? caught.message : "Unable to load team members." });
    } finally {
      setMembersLoading(false);
    }
  }, [accessToken, selectedTeamId]);

  useEffect(() => { void loadDirectory(); }, [loadDirectory]);
  useEffect(() => { void loadMembers(selectedTeamId); }, [loadMembers, selectedTeamId]);

  function openCreateTeam() {
    setEditingTeam(null);
    setTeamForm((current) => ({ avatarPublicId: "", avatarUrl: "", description: "", name: "", workspaceId: current.workspaceId }));
    setCreateOpen(true);
  }

  function openEditTeam(team: Team) {
    setEditingTeam(team);
    setTeamForm({
      avatarPublicId: team.avatarPublicId ?? "",
      avatarUrl: team.avatarUrl ?? "",
      description: team.description ?? "",
      name: team.name,
      workspaceId: team.workspaceId ?? "",
    });
    setCreateOpen(true);
  }

  async function handleSaveTeam() {
    if (!accessToken || !teamForm.name.trim()) return;
    setSaving(true);
    setMessage(null);
    try {
      const payload = {
        avatarPublicId: teamForm.avatarPublicId || null,
        avatarUrl: teamForm.avatarUrl || null,
        description: teamForm.description.trim() || undefined,
        name: teamForm.name.trim(),
        workspaceId: teamForm.workspaceId || undefined,
      };
      const saved = editingTeam
        ? await updateTeam(accessToken, editingTeam.id, payload)
        : await createTeam(accessToken, payload);
      setTeams((current) => [saved, ...current.filter((team) => team.id !== saved.id)]);
      setSelectedTeamId(saved.id);
      setActiveTab("members");
      setCreateOpen(false);
      setEditingTeam(null);
      setTeamForm((current) => ({ avatarPublicId: "", avatarUrl: "", description: "", name: "", workspaceId: current.workspaceId }));
      setMessage({ ok: true, text: editingTeam ? "Team updated." : "Team created." });
      await loadDirectory(true);
    } catch (caught) {
      setMessage({ ok: false, text: caught instanceof Error ? caught.message : editingTeam ? "Unable to update team." : "Unable to create team." });
    } finally {
      setSaving(false);
    }
  }

  async function handlePickTeamAvatar() {
    if (!accessToken) return;
    setAvatarUploading(true);
    setMessage(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false, type: "image/*" });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      const picked: PickedTeamAsset = {
        mimeType: asset.mimeType ?? "image/jpeg",
        name: asset.name ?? "team-avatar.jpg",
        size: asset.size ?? undefined,
        uri: asset.uri,
      };
      const intent = await createUploadIntent(accessToken, {
        entityId: editingTeam?.id,
        entityType: "TEAM",
        fileName: picked.name,
        mimeType: picked.mimeType ?? undefined,
        scope: "TEAM",
        sizeBytes: picked.size ?? undefined,
        visibility: "TEAM",
      });
      const uploadedUrl = await uploadPickedTeamAsset(intent, picked);
      const fileUrl = uploadedUrl || intent.fileUrl;
      if (!fileUrl) throw new Error("Upload provider did not return a file URL.");
      if (editingTeam?.id && /^https?:\/\//i.test(fileUrl)) {
        void createFileAsset(accessToken, {
          entityId: editingTeam.id,
          entityType: "TEAM",
          fileName: picked.name,
          fileUrl,
          mimeType: picked.mimeType ?? undefined,
          provider: intent.provider,
          scope: "TEAM",
          sizeBytes: picked.size ?? undefined,
          storageKey: intent.storageKey,
          visibility: intent.visibility,
        }).catch(() => undefined);
      }
      setTeamForm((current) => ({ ...current, avatarPublicId: intent.storageKey, avatarUrl: fileUrl }));
      setMessage({ ok: true, text: "Avatar uploaded. Save the team to keep it." });
    } catch (caught) {
      setMessage({ ok: false, text: caught instanceof Error ? caught.message : "Unable to upload team avatar." });
    } finally {
      setAvatarUploading(false);
    }
  }

  function confirmDeleteTeam(team: Team) {
    if (!accessToken) return;
    Alert.alert("Delete team?", `Delete ${team.name}? Teams with data are archived instead of hard-deleted.`, [
      { style: "cancel", text: "Cancel" },
      {
        onPress: () => {
          void (async () => {
            setSaving(true);
            setMessage(null);
            try {
              await deleteTeam(accessToken, team.id);
              setTeams((current) => current.filter((item) => item.id !== team.id));
              setSelectedTeamId((current) => (current === team.id ? "" : current));
              setMessage({ ok: true, text: "Team removed from active management." });
              await loadDirectory(true);
            } catch (caught) {
              setMessage({ ok: false, text: caught instanceof Error ? caught.message : "Unable to delete team." });
            } finally {
              setSaving(false);
            }
          })();
        },
        style: "destructive",
        text: "Delete",
      },
    ]);
  }

  async function handleInviteTeamMember() {
    if (!accessToken || !selectedTeam || !inviteForm.email.trim() || !inviteForm.firstName.trim() || !inviteForm.lastName.trim()) return;
    setSaving(true);
    setMessage(null);
    try {
      const result = await inviteTeamMember(accessToken, selectedTeam.id, {
        email: inviteForm.email.trim(),
        firstName: inviteForm.firstName.trim(),
        lastName: inviteForm.lastName.trim(),
        roleIds: inviteForm.roleIds,
        teamRole: inviteForm.teamRole,
      }) as TeamInviteResult;
      const deliveryMessage = describeInviteDelivery(result);
      setInviteForm({ email: "", firstName: "", lastName: "", roleIds: [], teamRole: "Member" });
      setMessage({ ok: result.deliveryStatus?.status !== "failed", text: deliveryMessage });
      await Promise.all([loadMembers(selectedTeam.id), loadDirectory(true)]);
    } catch (caught) {
      setMessage({ ok: false, text: caught instanceof Error ? caught.message : "Unable to invite team member." });
    } finally {
      setSaving(false);
    }
  }

  async function handleAddExistingUser() {
    if (!accessToken || !selectedTeam || !addForm.userId) return;
    setSaving(true);
    setMessage(null);
    try {
      await addTeamMember(accessToken, selectedTeam.id, { role: addForm.role, userId: addForm.userId });
      setAddForm({ role: "Member", userId: "" });
      setMessage({ ok: true, text: "Tenant user added to the team." });
      await Promise.all([loadMembers(selectedTeam.id), loadDirectory(true)]);
    } catch (caught) {
      setMessage({ ok: false, text: caught instanceof Error ? caught.message : "Unable to add team member." });
    } finally {
      setSaving(false);
    }
  }

  async function handleInviteTenantUser() {
    if (!accessToken || !tenantInviteForm.email.trim() || !tenantInviteForm.firstName.trim() || !tenantInviteForm.lastName.trim()) return;
    setSaving(true);
    setMessage(null);
    try {
      const result = await inviteTenantUser(accessToken, {
        email: tenantInviteForm.email.trim(),
        firstName: tenantInviteForm.firstName.trim(),
        lastName: tenantInviteForm.lastName.trim(),
        roleIds: tenantInviteForm.roleIds,
      }) as TeamInviteResult;
      setTenantInviteForm({ email: "", firstName: "", lastName: "", roleIds: [] });
      setMessage({ ok: result.deliveryStatus?.status !== "failed", text: describeInviteDelivery(result, "Tenant user invited.") });
      await loadDirectory(true);
    } catch (caught) {
      setMessage({ ok: false, text: caught instanceof Error ? caught.message : "Unable to invite tenant user." });
    } finally {
      setSaving(false);
    }
  }

  async function handleBulkInvite() {
    if (!accessToken) return;
    const usersToImport = parseBulkUsers(bulkText);
    if (!usersToImport.length) {
      setMessage({ ok: false, text: "Paste at least one valid email address." });
      return;
    }
    setSaving(true);
    setBulkResult(null);
    setMessage(null);
    try {
      const result = await bulkInviteTenantUsers(accessToken, {
        defaultRoleIds: bulkRoleIds,
        sendInvites: true,
        users: usersToImport,
      });
      setBulkResult(result);
      setMessage({ ok: result.failed ? false : true, text: `${result.created} created, ${result.updated} updated, ${result.skipped} skipped, ${result.failed} failed.` });
      await loadDirectory(true);
    } catch (caught) {
      setMessage({ ok: false, text: caught instanceof Error ? caught.message : "Unable to bulk invite users." });
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateRole(member: TeamMember, role: string) {
    if (!accessToken || !selectedTeam) return;
    setSaving(true);
    setMessage(null);
    try {
      await addTeamMember(accessToken, selectedTeam.id, { role, userId: member.userId });
      setMembers((current) => current.map((item) => (item.id === member.id ? { ...item, role } : item)));
      setMessage({ ok: true, text: "Team role updated." });
    } catch (caught) {
      setMessage({ ok: false, text: caught instanceof Error ? caught.message : "Unable to update team role." });
    } finally {
      setSaving(false);
    }
  }

  function confirmRemoveMember(member: TeamMember) {
    if (!accessToken || !selectedTeam) return;
    Alert.alert("Remove member?", `Remove ${displayUser(member.user)} from ${selectedTeam.name}?`, [
      { style: "cancel", text: "Cancel" },
      {
        onPress: () => {
          void (async () => {
            setSaving(true);
            try {
              await removeTeamMember(accessToken, selectedTeam.id, member.userId);
              setMembers((current) => current.filter((item) => item.id !== member.id));
              setMessage({ ok: true, text: "Member removed." });
              await loadDirectory(true);
            } catch (caught) {
              setMessage({ ok: false, text: caught instanceof Error ? caught.message : "Unable to remove member." });
            } finally {
              setSaving(false);
            }
          })();
        },
        style: "destructive",
        text: "Remove",
      },
    ]);
  }

  async function handleResendInvite(member: TeamMember) {
    if (!accessToken || !selectedTeam) return;
    setSaving(true);
    setMessage(null);
    try {
      const result = await resendTeamMemberInvite(accessToken, selectedTeam.id, member.userId);
      setMessage({
        ok: result.deliveryStatus?.status !== "failed",
        text: describeInviteDelivery(result),
      });
    } catch (caught) {
      setMessage({ ok: false, text: caught instanceof Error ? caught.message : "Unable to resend invitation." });
    } finally {
      setSaving(false);
    }
  }

  function confirmCancelInvite(member: TeamMember) {
    if (!accessToken || !selectedTeam) return;
    Alert.alert("Cancel invitation?", `Cancel the pending invite for ${displayUser(member.user)}?`, [
      { style: "cancel", text: "Keep invite" },
      {
        onPress: () => {
          void (async () => {
            setSaving(true);
            setMessage(null);
            try {
              await cancelTeamMemberInvite(accessToken, selectedTeam.id, member.userId);
              setMembers((current) => current.filter((item) => item.id !== member.id));
              setMessage({ ok: true, text: "Invitation cancelled." });
              await loadDirectory(true);
            } catch (caught) {
              setMessage({ ok: false, text: caught instanceof Error ? caught.message : "Unable to cancel invitation." });
            } finally {
              setSaving(false);
            }
          })();
        },
        style: "destructive",
        text: "Cancel invite",
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadDirectory(true)} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Pressable accessibilityRole="button" onPress={() => router.push("/(workspace)")} style={styles.iconButton}>
            <ArrowLeft color={colors.foreground} size={20} strokeWidth={2.8} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>Team</Text>
            <Text style={styles.title}>Team management</Text>
            <Text style={styles.subtitle}>Invite users, add members, bulk upload, and inspect RBAC roles.</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={() => void loadDirectory(true)} style={styles.iconButton}>
            <RefreshCw color={colors.foreground} size={19} strokeWidth={2.7} />
          </Pressable>
        </View>

        <View style={styles.metricsRow}>
          <Metric label="Teams" value={teams.length} />
          <Metric label="Users" value={users.length} />
          <Metric label="Roles" value={roles.length} />
          <Metric label="Perms" value={permissions.length} />
        </View>

        <View style={styles.actionRow}>
          <Pressable accessibilityRole="button" onPress={openCreateTeam} style={styles.primaryAction}>
            <Plus color={colors.black} size={17} strokeWidth={3} />
            <Text style={styles.primaryActionText}>New team</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => setActiveTab("directory")} style={styles.secondaryAction}>
            <UserPlus color={colors.foreground} size={17} strokeWidth={2.7} />
            <Text style={styles.secondaryActionText}>Invite user</Text>
          </Pressable>
        </View>

        {message ? (
          <Pressable accessibilityRole="button" onPress={() => setMessage(null)} style={[styles.notice, message.ok ? styles.noticeOk : styles.noticeBad]}>
            <Text style={[styles.noticeText, message.ok ? styles.noticeTextOk : styles.noticeTextBad]}>{message.text}</Text>
            <X color={message.ok ? colors.success : colors.danger} size={15} strokeWidth={2.7} />
          </Pressable>
        ) : null}

        {error ? <ErrorBlock error={error} onRetry={() => void loadDirectory()} /> : null}

        <View style={styles.searchBox}>
          <Search color={colors.inkSoft} size={18} strokeWidth={2.5} />
          <TextInput
            onChangeText={setQuery}
            placeholder="Search teams, workspace, description"
            placeholderTextColor={colors.inkSoft}
            style={styles.searchInput}
            value={query}
          />
        </View>

        {loading ? (
          <LoadingBlock />
        ) : (
          <>
            <ScrollView contentContainerStyle={styles.teamRail} horizontal showsHorizontalScrollIndicator={false}>
              {filteredTeams.map((team) => {
                const active = team.id === selectedTeam?.id;
                return (
                  <Pressable
                    accessibilityRole="button"
                    key={team.id}
                    onPress={() => {
                      setSelectedTeamId(team.id);
                      setActiveTab("members");
                    }}
                    style={[styles.teamCard, active && styles.teamCardActive]}
                  >
                    <View style={[styles.teamAvatar, !team.avatarUrl && { backgroundColor: teamAccent(team.name) }]}>
                      {team.avatarUrl ? <Image source={{ uri: team.avatarUrl }} style={styles.avatarImage} /> : <Text style={styles.teamAvatarText}>{teamInitials(team.name)}</Text>}
                    </View>
                    <View style={styles.flex}>
                      <Text numberOfLines={1} style={styles.teamName}>{team.name}</Text>
                      <Text numberOfLines={1} style={styles.teamMeta}>{team.workspace?.name ?? "Tenant-wide"}</Text>
                      <Text style={styles.teamFoot}>{team._count?.members ?? 0} members - {team._count?.projects ?? 0} projects</Text>
                    </View>
                  </Pressable>
                );
              })}
              {!filteredTeams.length ? (
                <View style={styles.emptyRailCard}>
                  <Text style={styles.emptyText}>No teams found.</Text>
                </View>
              ) : null}
            </ScrollView>

            {selectedTeam ? (
              <View style={styles.panel}>
                <View style={styles.panelHeader}>
                  <View style={[styles.panelAvatar, !selectedTeam.avatarUrl && { backgroundColor: teamAccent(selectedTeam.name) }]}>
                    {selectedTeam.avatarUrl ? <Image source={{ uri: selectedTeam.avatarUrl }} style={styles.avatarImage} /> : <Text style={styles.teamAvatarText}>{teamInitials(selectedTeam.name)}</Text>}
                  </View>
                  <View style={styles.flex}>
                    <Text numberOfLines={1} style={styles.panelTitle}>{selectedTeam.name}</Text>
                    <Text numberOfLines={2} style={styles.panelSub}>{selectedTeam.description || "No description added."}</Text>
                    <Text style={styles.panelWorkspace}>{selectedTeam.workspace?.name ?? "Tenant-wide"}</Text>
                  </View>
                  <View style={styles.panelActions}>
                    <Pressable accessibilityRole="button" disabled={saving} onPress={() => openEditTeam(selectedTeam)} style={styles.panelIconButton}>
                      <Pencil color={colors.foreground} size={16} strokeWidth={2.7} />
                    </Pressable>
                    <Pressable accessibilityRole="button" disabled={saving} onPress={() => confirmDeleteTeam(selectedTeam)} style={[styles.panelIconButton, styles.panelDangerButton]}>
                      <Trash2 color={colors.danger} size={16} strokeWidth={2.7} />
                    </Pressable>
                  </View>
                </View>

                <View style={styles.miniStats}>
                  <MiniStat label="Members" value={members.length} />
                  <MiniStat label="Active" value={activeMembers} />
                  <MiniStat label="Invited" value={invitedMembers} />
                  <MiniStat label="Perms" value={uniquePerms} />
                </View>

                <ScrollView contentContainerStyle={styles.tabRail} horizontal showsHorizontalScrollIndicator={false}>
                  {teamTabs(users.length, members.length).map((tab) => (
                    <Pressable
                      accessibilityRole="button"
                      key={tab.id}
                      onPress={() => setActiveTab(tab.id)}
                      style={[styles.tab, activeTab === tab.id && styles.tabActive]}
                    >
                      <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>{tab.label}</Text>
                    </Pressable>
                  ))}
                </ScrollView>

                {activeTab === "members" ? (
                  <MembersTab
                    loading={membersLoading}
                    members={members}
                    onCancelInvite={confirmCancelInvite}
                    onRemove={confirmRemoveMember}
                    onResendInvite={(member) => void handleResendInvite(member)}
                    onUpdateRole={(member, role) => void handleUpdateRole(member, role)}
                    saving={saving}
                  />
                ) : null}

                {activeTab === "invite" ? (
                  <View style={styles.formPanel}>
                    <SectionTitle icon={<Mail color={colors.accent} size={18} strokeWidth={2.6} />} title={`Invite to ${selectedTeam.name}`} />
                    <TeamInput label="Email" onChangeText={(email) => setInviteForm((current) => ({ ...current, email }))} value={inviteForm.email} />
                    <View style={styles.formGrid}>
                      <TeamInput label="First name" onChangeText={(firstName) => setInviteForm((current) => ({ ...current, firstName }))} value={inviteForm.firstName} />
                      <TeamInput label="Last name" onChangeText={(lastName) => setInviteForm((current) => ({ ...current, lastName }))} value={inviteForm.lastName} />
                    </View>
                    <TeamRolePicker label="Team role" onSelect={(teamRole) => setInviteForm((current) => ({ ...current, teamRole }))} selected={inviteForm.teamRole} />
                    <RolePicker onChange={(roleIds) => setInviteForm((current) => ({ ...current, roleIds }))} roles={roles} selected={inviteForm.roleIds} />
                    <SubmitButton disabled={saving} label={saving ? "Inviting..." : "Invite member"} onPress={() => void handleInviteTeamMember()} />
                  </View>
                ) : null}

                {activeTab === "add" ? (
                  <View style={styles.formPanel}>
                    <SectionTitle icon={<UserPlus color={colors.accent} size={18} strokeWidth={2.6} />} title="Add existing tenant user" />
                    <ScrollView contentContainerStyle={styles.userPickList} nestedScrollEnabled>
                      {addableUsers.slice(0, 30).map((tenantUser) => {
                        const active = addForm.userId === tenantUser.id;
                        return (
                          <Pressable key={tenantUser.id} onPress={() => setAddForm((current) => ({ ...current, userId: tenantUser.id }))} style={[styles.userPickRow, active && styles.userPickRowActive]}>
                            <Avatar label={displayUser(tenantUser)} />
                            <View style={styles.flex}>
                              <Text numberOfLines={1} style={styles.memberName}>{displayUser(tenantUser)}</Text>
                              <Text numberOfLines={1} style={styles.memberMeta}>Mail: {userWorkspaceMail(tenantUser)}</Text>
                              <Text numberOfLines={1} style={styles.memberMeta}>Login: {tenantUser.email} - {tenantUser.status}</Text>
                            </View>
                          </Pressable>
                        );
                      })}
                      {!addableUsers.length ? <Text style={styles.emptyText}>No addable tenant users found.</Text> : null}
                    </ScrollView>
                    <TeamRolePicker label="Team role" onSelect={(role) => setAddForm((current) => ({ ...current, role }))} selected={addForm.role} />
                    <SubmitButton disabled={saving || !addForm.userId} label={saving ? "Adding..." : "Add user"} onPress={() => void handleAddExistingUser()} />
                  </View>
                ) : null}

                {activeTab === "directory" ? (
                  <View style={styles.formPanel}>
                    <SectionTitle icon={<Building2 color={colors.accent} size={18} strokeWidth={2.6} />} title="Tenant users" />
                    <View style={styles.innerPanel}>
                      <Text style={styles.formTitle}>Invite tenant user</Text>
                      <TeamInput label="Email" onChangeText={(email) => setTenantInviteForm((current) => ({ ...current, email }))} value={tenantInviteForm.email} />
                      <View style={styles.formGrid}>
                        <TeamInput label="First name" onChangeText={(firstName) => setTenantInviteForm((current) => ({ ...current, firstName }))} value={tenantInviteForm.firstName} />
                        <TeamInput label="Last name" onChangeText={(lastName) => setTenantInviteForm((current) => ({ ...current, lastName }))} value={tenantInviteForm.lastName} />
                      </View>
                      <RolePicker onChange={(roleIds) => setTenantInviteForm((current) => ({ ...current, roleIds }))} roles={roles} selected={tenantInviteForm.roleIds} />
                      <SubmitButton disabled={saving} label={saving ? "Inviting..." : "Invite tenant user"} onPress={() => void handleInviteTenantUser()} />
                    </View>
                    <View style={styles.directoryList}>
                      {users.slice(0, 40).map((tenantUser) => (
                        <View key={tenantUser.id} style={styles.memberRow}>
                          <Avatar label={displayUser(tenantUser)} />
                          <View style={styles.flex}>
                            <Text numberOfLines={1} style={styles.memberName}>{displayUser(tenantUser)}</Text>
                            <Text numberOfLines={1} style={styles.memberMeta}>Mail: {userWorkspaceMail(tenantUser)}</Text>
                            <Text numberOfLines={1} style={styles.memberMeta}>Login: {tenantUser.email} - {tenantUser.status} - {tenantUser.roles?.length ?? 0} roles</Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  </View>
                ) : null}

                {activeTab === "bulk" ? (
                  <View style={styles.formPanel}>
                    <SectionTitle icon={<BookOpen color={colors.accent} size={18} strokeWidth={2.6} />} title="Bulk upload" />
                    <Text style={styles.formSub}>Paste one user per line: email, first name, last name. Email-only lines also work.</Text>
                    <TextInput
                      multiline
                      onChangeText={setBulkText}
                      placeholder={"ada@acme.com,Ada,Lovelace\ngrace@acme.com,Grace,Hopper"}
                      placeholderTextColor={colors.inkSoft}
                      style={[styles.input, styles.textArea, styles.bulkInput]}
                      value={bulkText}
                    />
                    <RolePicker onChange={setBulkRoleIds} roles={roles} selected={bulkRoleIds} />
                    <SubmitButton disabled={saving} label={saving ? "Importing..." : "Import users"} onPress={() => void handleBulkInvite()} />
                    {bulkResult ? (
                      <View style={styles.resultBox}>
                        <Text style={styles.formSub}>{bulkResult.created} created - {bulkResult.updated} updated - {bulkResult.skipped} skipped - {bulkResult.failed} failed</Text>
                        {bulkResult.results.slice(0, 5).map((row) => (
                          <Text key={row.email} numberOfLines={1} style={styles.memberMeta}>{row.email}: {row.status}</Text>
                        ))}
                      </View>
                    ) : null}
                  </View>
                ) : null}

                {activeTab === "roles" ? <RolesTab roles={roles} /> : null}
              </View>
            ) : (
              <EmptyBlock title="No team selected" text="Create or select a team to manage membership." />
            )}
          </>
        )}

        <TeamCreateSheet
          avatarUploading={avatarUploading}
          editing={Boolean(editingTeam)}
          form={teamForm}
          onChange={setTeamForm}
          onClearAvatar={() => setTeamForm((current) => ({ ...current, avatarPublicId: "", avatarUrl: "" }))}
          onClose={() => {
            setCreateOpen(false);
            setEditingTeam(null);
          }}
          onPickAvatar={() => void handlePickTeamAvatar()}
          onSave={() => void handleSaveTeam()}
          open={createOpen}
          saving={saving}
          workspaces={workspaces}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.miniStat}>
      <Text style={styles.miniValue}>{value}</Text>
      <Text style={styles.miniLabel}>{label}</Text>
    </View>
  );
}

function MembersTab({
  loading,
  members,
  onCancelInvite,
  onRemove,
  onResendInvite,
  onUpdateRole,
  saving,
}: {
  loading: boolean;
  members: TeamMember[];
  onCancelInvite: (member: TeamMember) => void;
  onRemove: (member: TeamMember) => void;
  onResendInvite: (member: TeamMember) => void;
  onUpdateRole: (member: TeamMember, role: string) => void;
  saving: boolean;
}) {
  if (loading) {
    return <LoadingBlock label="Loading members..." />;
  }
  if (!members.length) {
    return <EmptyBlock title="No members yet" text="Use Invite or Add user to build this team." />;
  }
  return (
    <View style={styles.memberStack}>
      {members.map((member) => (
        <MemberCard
          key={member.id}
          member={member}
          onCancelInvite={onCancelInvite}
          onRemove={onRemove}
          onResendInvite={onResendInvite}
          onUpdateRole={onUpdateRole}
          saving={saving}
        />
      ))}
    </View>
  );
}

function MemberCard({
  member,
  onCancelInvite,
  onRemove,
  onResendInvite,
  onUpdateRole,
  saving,
}: {
  member: TeamMember;
  onCancelInvite: (member: TeamMember) => void;
  onRemove: (member: TeamMember) => void;
  onResendInvite: (member: TeamMember) => void;
  onUpdateRole: (member: TeamMember, role: string) => void;
  saving: boolean;
}) {
  const permissions = memberPermissionLabels(member);
  const isInvited = member.user.status === "INVITED";

  return (
    <View style={styles.memberCard}>
      <View style={styles.memberTop}>
        <Avatar label={displayUser(member.user)} />
        <View style={styles.flex}>
          <Text numberOfLines={1} style={styles.memberName}>{displayUser(member.user)}</Text>
          <Text numberOfLines={1} style={styles.memberMeta}>Mail: {userWorkspaceMail(member.user)}</Text>
          <Text numberOfLines={1} style={styles.memberMeta}>Login: {member.user.email} - {member.user.status}</Text>
        </View>
        {!isInvited ? (
          <Pressable accessibilityRole="button" disabled={saving} onPress={() => onRemove(member)} style={styles.removeBtn}>
            <Trash2 color={colors.danger} size={16} strokeWidth={2.5} />
          </Pressable>
        ) : null}
      </View>
      {isInvited ? (
        <View style={styles.inviteActionRow}>
          <Pressable accessibilityRole="button" disabled={saving} onPress={() => onResendInvite(member)} style={styles.inviteActionButton}>
            <RefreshCw color={colors.foreground} size={14} strokeWidth={2.6} />
            <Text style={styles.inviteActionText}>Resend</Text>
          </Pressable>
          <Pressable accessibilityRole="button" disabled={saving} onPress={() => onCancelInvite(member)} style={[styles.inviteActionButton, styles.inviteCancelButton]}>
            <X color={colors.danger} size={14} strokeWidth={2.6} />
            <Text style={styles.inviteCancelText}>Cancel invite</Text>
          </Pressable>
        </View>
      ) : null}
      <TeamRolePicker label="Team role" onSelect={(role) => onUpdateRole(member, role)} selected={member.role ?? "Member"} />
      <View style={styles.permissionRow}>
        {permissions.slice(0, 5).map((permission) => (
          <PermissionPill key={permission} label={permission} />
        ))}
        {permissions.length > 5 ? <Text style={styles.memberMeta}>+{permissions.length - 5}</Text> : null}
      </View>
    </View>
  );
}

function RolesTab({ roles }: { roles: Role[] }) {
  if (!roles.length) {
    return <EmptyBlock title="No roles" text="No roles were returned by the API." />;
  }
  return (
    <View style={styles.roleStack}>
      {roles.map((role) => {
        const permissions = role.permissions?.map(({ permission }) => permissionLabel(permission)).filter(Boolean) ?? [];
        return (
          <View key={role.id} style={styles.roleCard}>
            <View style={styles.roleHeader}>
              <View style={styles.flex}>
                <Text style={styles.roleTitle}>{role.name}</Text>
                <Text style={styles.memberMeta}>{role.description ?? "Tenant role"}</Text>
              </View>
              {role.isSystem ? (
                <View style={styles.systemPill}>
                  <Text style={styles.systemPillText}>System</Text>
                </View>
              ) : null}
            </View>
            <View style={styles.permissionRow}>
              {permissions.slice(0, 8).map((permission) => <PermissionPill key={permission} label={permission} />)}
            </View>
            <Text style={styles.memberMeta}>{permissions.length} permissions - {role._count?.users ?? 0} users</Text>
          </View>
        );
      })}
    </View>
  );
}

function TeamCreateSheet({
  avatarUploading,
  editing,
  form,
  onChange,
  onClearAvatar,
  onClose,
  onPickAvatar,
  onSave,
  open,
  saving,
  workspaces,
}: {
  avatarUploading: boolean;
  editing: boolean;
  form: TeamFormState;
  onChange: (form: TeamFormState) => void;
  onClearAvatar: () => void;
  onClose: () => void;
  onPickAvatar: () => void;
  onSave: () => void;
  open: boolean;
  saving: boolean;
  workspaces: Workspace[];
}) {
  if (!open) return null;
  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalBackdrop}>
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetTitleRow}>
              <View style={styles.flex}>
                <Text style={styles.sheetEyebrow}>{editing ? "Team update" : "New team"}</Text>
                <Text style={styles.sheetTitle}>{editing ? "Edit team" : "Create team"}</Text>
              </View>
              <Pressable accessibilityRole="button" onPress={onClose} style={styles.closeBtn}>
                <X color={colors.foreground} size={20} strokeWidth={2.8} />
              </Pressable>
            </View>
          </View>
          <ScrollView contentContainerStyle={styles.sheetContent} showsVerticalScrollIndicator={false}>
            <View style={styles.avatarPickerCard}>
              <View style={[styles.avatarPickerPreview, !form.avatarUrl && { backgroundColor: teamAccent(form.name || "Team") }]}>
                {form.avatarUrl ? <Image source={{ uri: form.avatarUrl }} style={styles.avatarImage} /> : <Text style={styles.teamAvatarText}>{teamInitials(form.name || "Team")}</Text>}
              </View>
              <View style={styles.flex}>
                <Text style={styles.avatarPickerTitle}>{form.name.trim() || "Team avatar"}</Text>
                <Text style={styles.avatarPickerText}>Upload a square image for team lists, project ownership, and workspace member views.</Text>
              </View>
              <Pressable accessibilityRole="button" disabled={avatarUploading} onPress={onPickAvatar} style={styles.avatarPickerButton}>
                {avatarUploading ? <ActivityIndicator color={colors.black} /> : <ImagePlus color={colors.black} size={17} strokeWidth={2.8} />}
              </Pressable>
            </View>
            {form.avatarUrl ? (
              <Pressable accessibilityRole="button" onPress={onClearAvatar} style={styles.clearAvatarButton}>
                <X color={colors.danger} size={14} strokeWidth={2.8} />
                <Text style={styles.clearAvatarText}>Remove selected avatar</Text>
              </Pressable>
            ) : null}
            <TeamInput autoFocus label="Team name" onChangeText={(name) => onChange({ ...form, name })} value={form.name} />
            <TeamInput label="Description" multiline onChangeText={(description) => onChange({ ...form, description })} value={form.description} />
            <Field label="Workspace">
              <ScrollView contentContainerStyle={styles.chipRow} horizontal showsHorizontalScrollIndicator={false}>
                <ChoiceChip active={!form.workspaceId} label="Tenant-wide" onPress={() => onChange({ ...form, workspaceId: "" })} />
                {workspaces.map((workspace) => (
                  <ChoiceChip
                    active={form.workspaceId === workspace.id}
                    key={workspace.id}
                    label={workspace.name}
                    onPress={() => onChange({ ...form, workspaceId: workspace.id })}
                  />
                ))}
              </ScrollView>
            </Field>
          </ScrollView>
          <View style={styles.sheetActions}>
            <Pressable accessibilityRole="button" onPress={onClose} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable accessibilityRole="button" disabled={saving || !form.name.trim()} onPress={onSave} style={[styles.saveBtn, (saving || !form.name.trim()) && styles.disabled]}>
              <Text style={styles.saveText}>{saving ? "Saving..." : editing ? "Save changes" : "Create team"}</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function TeamInput({
  autoFocus = false,
  label,
  multiline = false,
  onChangeText,
  value,
}: {
  autoFocus?: boolean;
  label: string;
  multiline?: boolean;
  onChangeText: (value: string) => void;
  value: string;
}) {
  return (
    <Field label={label}>
      <TextInput
        autoFocus={autoFocus}
        multiline={multiline}
        onChangeText={onChangeText}
        placeholder={label}
        placeholderTextColor={colors.inkSoft}
        style={[styles.input, multiline && styles.textArea]}
        value={value}
      />
    </Field>
  );
}

function TeamRolePicker({ label, onSelect, selected }: { label: string; onSelect: (role: string) => void; selected: string }) {
  return (
    <Field label={label}>
      <ScrollView contentContainerStyle={styles.chipRow} horizontal showsHorizontalScrollIndicator={false}>
        {teamRoleOptions.map((role) => (
          <ChoiceChip active={selected === role} key={role} label={role} onPress={() => onSelect(role)} />
        ))}
      </ScrollView>
    </Field>
  );
}

function RolePicker({ onChange, roles, selected }: { onChange: (roleIds: string[]) => void; roles: Role[]; selected: string[] }) {
  if (!roles.length) return null;
  return (
    <Field label="Tenant roles">
      <ScrollView contentContainerStyle={styles.chipRow} horizontal showsHorizontalScrollIndicator={false}>
        {roles.map((role) => {
          const active = selected.includes(role.id);
          return <ChoiceChip active={active} key={role.id} label={role.name} onPress={() => onChange(toggleString(selected, role.id))} />;
        })}
      </ScrollView>
    </Field>
  );
}

function SubmitButton({ disabled, label, onPress }: { disabled?: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[styles.submitBtn, disabled && styles.disabled]}>
      <Text style={styles.submitText}>{label}</Text>
    </Pressable>
  );
}

function SectionTitle({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <View style={styles.sectionTitleRow}>
      {icon}
      <Text style={styles.formTitle}>{title}</Text>
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

function ChoiceChip({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.choiceChip, active && styles.choiceChipActive]}>
      <Text style={[styles.choiceText, active && styles.choiceTextActive]}>{label}</Text>
    </Pressable>
  );
}

function PermissionPill({ label }: { label: string }) {
  return (
    <View style={styles.permissionPill}>
      <Text numberOfLines={1} style={styles.permissionText}>{label}</Text>
    </View>
  );
}

function Avatar({ label }: { label: string }) {
  return (
    <View style={styles.memberAvatar}>
      <Text style={styles.memberAvatarText}>{initials(label)}</Text>
    </View>
  );
}

function LoadingBlock({ label = "Loading team management..." }: { label?: string }) {
  return (
    <View style={styles.stateBox}>
      <ActivityIndicator color={colors.accent} />
      <Text style={styles.emptyText}>{label}</Text>
    </View>
  );
}

function ErrorBlock({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <View style={styles.errorBox}>
      <Text style={styles.errorTitle}>Team data unavailable</Text>
      <Text style={styles.errorText}>{error}</Text>
      <Pressable accessibilityRole="button" onPress={onRetry} style={styles.retryBtn}>
        <Text style={styles.retryText}>Try again</Text>
      </Pressable>
    </View>
  );
}

function EmptyBlock({ text, title }: { text: string; title: string }) {
  return (
    <View style={styles.emptyBlock}>
      <UsersRound color={colors.inkSoft} size={26} strokeWidth={2.5} />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

function teamTabs(users: number, members: number): { id: TeamTab; label: string }[] {
  return [
    { id: "members", label: `Members (${members})` },
    { id: "invite", label: "Invite" },
    { id: "add", label: "Add user" },
    { id: "directory", label: `Tenant users (${users})` },
    { id: "bulk", label: "Bulk upload" },
    { id: "roles", label: "Roles" },
  ];
}

function displayUser(user: { email?: string; firstName?: string; lastName?: string }) {
  const name = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim();
  return name || user.email || "Unknown member";
}

function userWorkspaceMail(user: { email?: string; internalEmail?: string | null; internalMailbox?: { address?: string | null } | null }) {
  return user.internalEmail ?? user.internalMailbox?.address ?? user.email ?? "No mailbox";
}

function describeInviteDelivery(result?: TeamInviteResult, fallback = "Invite created and user added.") {
  const delivery = result?.deliveryStatus;
  if (!delivery) return fallback;
  if (delivery.channel === "in_app") return "Existing user notified in the app.";
  if (delivery.channel === "none") return delivery.message || fallback;
  if (delivery.status === "sent") return "Invite email sent.";
  if (delivery.status === "skipped") {
    return `Invite created, but email delivery is disabled${delivery.provider ? ` (${delivery.provider})` : ""}. Configure mail and use Resend.`;
  }
  return `Invite created, but email delivery failed${delivery.provider ? ` via ${delivery.provider}` : ""}${delivery.error ? `: ${delivery.error}` : "."}`;
}

function initials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}` : value.slice(0, 2);
  return letters.toUpperCase();
}

function teamAccent(name: string) {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash * 31 + name.charCodeAt(index)) >>> 0;
  }
  return teamAccents[hash % teamAccents.length] ?? colors.accent;
}

function teamInitials(name: string) {
  return name.split(/\s+/).filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "TM";
}

function permissionLabel(permission: Permission) {
  return `${permission.action}:${permission.subject}`.toLowerCase();
}

function memberPermissionLabels(member: TeamMember) {
  const labels = new Set<string>();
  member.user.roles?.forEach(({ role }) => {
    role.permissions?.forEach(({ permission }) => labels.add(permissionLabel(permission)));
  });
  return [...labels];
}

function toggleString(values: string[], value: string) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function parseBulkUsers(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [email = "", firstName = "", lastName = ""] = line.split(/[,\t;]/).map((part) => part.trim());
      return { email, firstName: firstName || undefined, lastName: lastName || undefined };
    })
    .filter((user) => /@/.test(user.email));
}

async function uploadPickedTeamAsset(intent: UploadIntent, asset: PickedTeamAsset) {
  if (!intent.uploadUrl) return undefined;
  if (intent.method === "POST") {
    const form = new FormData();
    Object.entries(intent.fields ?? {}).forEach(([key, value]) => form.append(key, String(value)));
    form.append("file", { name: asset.name, type: asset.mimeType || "application/octet-stream", uri: asset.uri } as unknown as Blob);
    const response = await fetch(intent.uploadUrl, { body: form, method: "POST" });
    if (!response.ok) throw new Error("Upload provider rejected the image.");
    const payload = await response.json().catch(() => undefined);
    if (payload && typeof payload === "object" && "secure_url" in payload && typeof payload.secure_url === "string") return payload.secure_url;
    if (payload && typeof payload === "object" && "url" in payload && typeof payload.url === "string") return payload.url;
    return undefined;
  }
  const fileResponse = await fetch(asset.uri);
  const blob = await fileResponse.blob();
  const response = await fetch(intent.uploadUrl, { body: blob, headers: intent.headers as Record<string, string>, method: intent.method });
  if (!response.ok) throw new Error("Upload provider rejected the image.");
  return undefined;
}

const styles = StyleSheet.create(withFontStyles({
  safe: { backgroundColor: colors.background, flex: 1 },
  content: { gap: 16, paddingBottom: 132, paddingHorizontal: 22, paddingTop: 18 },
  header: { alignItems: "flex-start", flexDirection: "row", gap: 12 },
  iconButton: {
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
  headerCopy: { flex: 1, gap: 4, minWidth: 0 },
  eyebrow: { color: colors.accent, fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  title: { color: colors.foreground, fontSize: 27, fontWeight: "900", letterSpacing: -0.4 },
  subtitle: { color: colors.inkSoft, fontSize: 13, fontWeight: "700", lineHeight: 18 },
  metricsRow: {
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: "row",
    overflow: "hidden",
    ...shadow.card,
  },
  metric: { alignItems: "center", borderRightColor: colors.line, borderRightWidth: 1, flex: 1, paddingVertical: 14 },
  metricValue: { color: colors.foreground, fontSize: 22, fontWeight: "900" },
  metricLabel: { color: colors.inkSoft, fontSize: 9, fontWeight: "900", letterSpacing: 0.6, marginTop: 4, textTransform: "uppercase" },
  actionRow: { flexDirection: "row", gap: 10 },
  primaryAction: { alignItems: "center", backgroundColor: colors.primary, borderRadius: 18, flexDirection: "row", gap: 8, minHeight: 48, paddingHorizontal: 16 },
  primaryActionText: { color: colors.black, fontSize: 14, fontWeight: "900" },
  secondaryAction: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    minHeight: 48,
    paddingHorizontal: 16,
  },
  secondaryActionText: { color: colors.foreground, fontSize: 14, fontWeight: "900" },
  notice: { alignItems: "center", borderRadius: 16, borderWidth: 1, flexDirection: "row", gap: 8, paddingHorizontal: 14, paddingVertical: 12 },
  noticeOk: { backgroundColor: colors.greenSoft, borderColor: "#bbf7d0" },
  noticeBad: { backgroundColor: colors.redSoft, borderColor: "#fecaca" },
  noticeText: { flex: 1, fontSize: 13, fontWeight: "900" },
  noticeTextOk: { color: colors.success },
  noticeTextBad: { color: colors.danger },
  searchBox: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: 56,
    paddingHorizontal: 16,
    ...shadow.card,
  },
  searchInput: { color: colors.foreground, flex: 1, fontSize: 15, fontWeight: "800" },
  teamRail: { gap: 10, paddingRight: 20 },
  teamCard: {
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: radii.xl,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    minHeight: 104,
    padding: 12,
    width: 244,
    ...shadow.card,
  },
  teamCardActive: { backgroundColor: colors.yellowSoft, borderColor: colors.primaryDark },
  teamAvatar: { alignItems: "center", borderRadius: 16, height: 44, justifyContent: "center", overflow: "hidden", width: 44 },
  avatarImage: { height: "100%", width: "100%" },
  teamAvatarText: { color: colors.white, fontSize: 13, fontWeight: "900" },
  teamName: { color: colors.foreground, fontSize: 15, fontWeight: "900" },
  teamMeta: { color: colors.inkSoft, fontSize: 12, fontWeight: "800", marginTop: 2 },
  teamFoot: { color: colors.inkSoft, fontSize: 11, fontWeight: "900", marginTop: 10 },
  emptyRailCard: { alignItems: "center", backgroundColor: colors.white, borderColor: colors.line, borderRadius: radii.xl, borderWidth: 1, justifyContent: "center", minHeight: 90, padding: 16, width: 220 },
  panel: { backgroundColor: colors.white, borderColor: colors.line, borderRadius: radii["2xl"], borderWidth: 1, gap: 14, padding: 16, ...shadow.card },
  panelHeader: { alignItems: "center", flexDirection: "row", gap: 12 },
  panelAvatar: { alignItems: "center", borderRadius: 18, height: 56, justifyContent: "center", overflow: "hidden", width: 56 },
  panelTitle: { color: colors.foreground, fontSize: 19, fontWeight: "900" },
  panelSub: { color: colors.inkSoft, fontSize: 12, fontWeight: "800", lineHeight: 17, marginTop: 2 },
  panelWorkspace: { color: colors.accent, fontSize: 11, fontWeight: "900", marginTop: 4 },
  panelActions: { flexDirection: "row", gap: 8 },
  panelIconButton: { alignItems: "center", backgroundColor: colors.panelMuted, borderColor: colors.line, borderRadius: 14, borderWidth: 1, height: 38, justifyContent: "center", width: 38 },
  panelDangerButton: { backgroundColor: colors.redSoft, borderColor: "#fecaca" },
  miniStats: { backgroundColor: colors.panelMuted, borderRadius: radii.lg, flexDirection: "row", overflow: "hidden" },
  miniStat: { alignItems: "center", borderRightColor: colors.line, borderRightWidth: 1, flex: 1, paddingVertical: 10 },
  miniValue: { color: colors.foreground, fontSize: 17, fontWeight: "900" },
  miniLabel: { color: colors.inkSoft, fontSize: 9, fontWeight: "900", letterSpacing: 0.6, marginTop: 3, textTransform: "uppercase" },
  tabRail: { gap: 8, paddingRight: 16 },
  tab: { backgroundColor: colors.panelMuted, borderColor: colors.line, borderRadius: 999, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 9 },
  tabActive: { backgroundColor: colors.black, borderColor: colors.black },
  tabText: { color: colors.inkSoft, fontSize: 12, fontWeight: "900" },
  tabTextActive: { color: colors.white },
  formPanel: { backgroundColor: colors.panelMuted, borderRadius: radii.xl, gap: 14, padding: 14 },
  innerPanel: { backgroundColor: colors.white, borderColor: colors.line, borderRadius: radii.xl, borderWidth: 1, gap: 12, padding: 12 },
  sectionTitleRow: { alignItems: "center", flexDirection: "row", gap: 8 },
  formTitle: { color: colors.foreground, fontSize: 16, fontWeight: "900" },
  formSub: { color: colors.inkSoft, fontSize: 12, fontWeight: "800", lineHeight: 17 },
  memberStack: { gap: 10 },
  memberCard: { backgroundColor: colors.panelMuted, borderRadius: radii.xl, gap: 12, padding: 12 },
  memberTop: { alignItems: "center", flexDirection: "row", gap: 12, minHeight: 52 },
  memberAvatar: { alignItems: "center", backgroundColor: colors.yellowSoft, borderRadius: 16, height: 42, justifyContent: "center", width: 42 },
  memberAvatarText: { color: colors.black, fontSize: 13, fontWeight: "900" },
  memberName: { color: colors.foreground, fontSize: 14, fontWeight: "900" },
  memberMeta: { color: colors.inkSoft, fontSize: 12, fontWeight: "800", marginTop: 2 },
  removeBtn: { alignItems: "center", backgroundColor: colors.redSoft, borderRadius: 14, height: 38, justifyContent: "center", width: 38 },
  inviteActionRow: { flexDirection: "row", gap: 8 },
  inviteActionButton: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 7,
    minHeight: 40,
    paddingHorizontal: 12,
  },
  inviteActionText: { color: colors.foreground, fontSize: 12, fontWeight: "900" },
  inviteCancelButton: { backgroundColor: colors.redSoft, borderColor: "#fecaca" },
  inviteCancelText: { color: colors.danger, fontSize: 12, fontWeight: "900" },
  permissionRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  permissionPill: { backgroundColor: colors.white, borderColor: colors.line, borderRadius: 999, borderWidth: 1, maxWidth: 150, paddingHorizontal: 8, paddingVertical: 5 },
  permissionText: { color: colors.inkSoft, fontSize: 10, fontWeight: "900" },
  userPickList: { gap: 8, maxHeight: 260 },
  userPickRow: { alignItems: "center", backgroundColor: colors.white, borderColor: colors.line, borderRadius: radii.lg, borderWidth: 1, flexDirection: "row", gap: 10, minHeight: 60, padding: 10 },
  userPickRowActive: { backgroundColor: colors.yellowSoft, borderColor: colors.primaryDark },
  directoryList: { gap: 8 },
  memberRow: { alignItems: "center", backgroundColor: colors.white, borderColor: colors.line, borderRadius: radii.lg, borderWidth: 1, flexDirection: "row", gap: 10, minHeight: 60, padding: 10 },
  bulkInput: { minHeight: 150 },
  resultBox: { backgroundColor: colors.white, borderColor: colors.line, borderRadius: radii.lg, borderWidth: 1, gap: 4, padding: 12 },
  roleStack: { gap: 10 },
  roleCard: { backgroundColor: colors.panelMuted, borderColor: colors.line, borderRadius: radii.xl, borderWidth: 1, gap: 10, padding: 14 },
  roleHeader: { alignItems: "flex-start", flexDirection: "row", gap: 10, justifyContent: "space-between" },
  roleTitle: { color: colors.foreground, fontSize: 15, fontWeight: "900" },
  systemPill: { backgroundColor: colors.yellowSoft, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  systemPillText: { color: "#b45309", fontSize: 10, fontWeight: "900" },
  submitBtn: { alignItems: "center", backgroundColor: colors.primary, borderRadius: radii.lg, justifyContent: "center", minHeight: 52 },
  submitText: { color: colors.black, fontSize: 14, fontWeight: "900" },
  stateBox: { alignItems: "center", backgroundColor: colors.white, borderColor: colors.line, borderRadius: radii.xl, borderWidth: 1, flexDirection: "row", gap: 12, padding: 16, ...shadow.card },
  emptyBlock: { alignItems: "center", backgroundColor: colors.white, borderColor: colors.line, borderRadius: radii.xl, borderWidth: 1, gap: 8, padding: 22, ...shadow.card },
  emptyTitle: { color: colors.foreground, fontSize: 16, fontWeight: "900" },
  emptyText: { color: colors.inkSoft, fontSize: 13, fontWeight: "800", lineHeight: 18 },
  errorBox: { backgroundColor: colors.redSoft, borderColor: "#fecaca", borderRadius: radii.xl, borderWidth: 1, gap: 8, padding: 16 },
  errorTitle: { color: colors.danger, fontSize: 15, fontWeight: "900" },
  errorText: { color: colors.danger, fontSize: 13, fontWeight: "800", lineHeight: 18 },
  retryBtn: { alignItems: "center", alignSelf: "flex-start", backgroundColor: colors.white, borderRadius: 14, minHeight: 38, paddingHorizontal: 14 },
  retryText: { color: colors.foreground, fontSize: 13, fontWeight: "900", paddingTop: 10 },
  modalBackdrop: { backgroundColor: "rgba(16,16,15,0.28)", flex: 1, justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.background, borderTopLeftRadius: 32, borderTopRightRadius: 32, maxHeight: "92%", overflow: "hidden", ...shadow.heavy },
  sheetHeader: { backgroundColor: colors.background },
  sheetHandle: { alignSelf: "center", backgroundColor: colors.line, borderRadius: 99, height: 4, marginTop: 12, width: 44 },
  sheetTitleRow: { alignItems: "center", flexDirection: "row", gap: 12, paddingHorizontal: 20, paddingVertical: 14 },
  sheetEyebrow: { color: colors.accent, fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
  sheetTitle: { color: colors.foreground, fontSize: 24, fontWeight: "900", letterSpacing: -0.3 },
  closeBtn: { alignItems: "center", backgroundColor: colors.panelMuted, borderRadius: 16, height: 36, justifyContent: "center", width: 36 },
  sheetContent: { gap: 16, padding: 20 },
  avatarPickerCard: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: radii.xl,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    padding: 12,
  },
  avatarPickerPreview: { alignItems: "center", borderRadius: 18, height: 58, justifyContent: "center", overflow: "hidden", width: 58 },
  avatarPickerTitle: { color: colors.foreground, fontSize: 15, fontWeight: "900" },
  avatarPickerText: { color: colors.inkSoft, fontSize: 12, fontWeight: "800", lineHeight: 17, marginTop: 2 },
  avatarPickerButton: { alignItems: "center", backgroundColor: colors.primary, borderRadius: 16, height: 42, justifyContent: "center", width: 42 },
  clearAvatarButton: { alignItems: "center", alignSelf: "flex-start", backgroundColor: colors.redSoft, borderColor: "#fecaca", borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 6, minHeight: 34, paddingHorizontal: 12 },
  clearAvatarText: { color: colors.danger, fontSize: 12, fontWeight: "900" },
  sheetActions: { alignItems: "center", borderTopColor: colors.line, borderTopWidth: 1, flexDirection: "row", gap: 10, justifyContent: "flex-end", padding: 16 },
  cancelBtn: { alignItems: "center", backgroundColor: colors.white, borderColor: colors.line, borderRadius: radii.lg, borderWidth: 1, height: 50, justifyContent: "center", paddingHorizontal: 18 },
  cancelText: { color: colors.foreground, fontSize: 14, fontWeight: "900" },
  saveBtn: { alignItems: "center", backgroundColor: colors.primary, borderRadius: radii.lg, height: 50, justifyContent: "center", paddingHorizontal: 18 },
  saveText: { color: colors.black, fontSize: 14, fontWeight: "900" },
  disabled: { opacity: 0.45 },
  field: { gap: 8 },
  fieldLabel: { color: colors.foreground, fontSize: 13, fontWeight: "900" },
  input: { backgroundColor: colors.white, borderColor: colors.line, borderRadius: radii.xl, borderWidth: 1, color: colors.foreground, fontSize: 15, fontWeight: "800", minHeight: 52, paddingHorizontal: 15 },
  textArea: { minHeight: 110, paddingTop: 13, textAlignVertical: "top" },
  formGrid: { flexDirection: "row", gap: 10 },
  chipRow: { gap: 8, paddingRight: 16 },
  choiceChip: { alignItems: "center", backgroundColor: colors.white, borderColor: colors.line, borderRadius: radii.md, borderWidth: 1, justifyContent: "center", minHeight: 40, paddingHorizontal: 13 },
  choiceChipActive: { backgroundColor: colors.foreground, borderColor: colors.foreground },
  choiceText: { color: colors.inkSoft, fontSize: 13, fontWeight: "900" },
  choiceTextActive: { color: colors.white },
  flex: { flex: 1, minWidth: 0 },
}));
