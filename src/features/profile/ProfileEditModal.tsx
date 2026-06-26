import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ArrowLeft, ArrowRight, Check, Globe2, ImageIcon, Mail, UserRound, X } from "lucide-react-native";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { updateMyProfile } from "@/lib/api";
import { useAuthSession } from "@/lib/auth/AuthSessionProvider";
import { withFontStyles } from "@/lib/theme/fontDefaults";
import { colors, radii, shadow } from "@/lib/theme/tokens";

type ProfileEditModalProps = {
  onClose: () => void;
  visible: boolean;
};

type ProfileDraft = {
  avatarUrl: string;
  firstName: string;
  lastName: string;
  locale: string;
  timezone: string;
};

const steps = [
  { label: "Profile", title: "Name and avatar" },
  { label: "Settings", title: "Locale and timezone" },
] as const;

export function ProfileEditModal({ onClose, visible }: ProfileEditModalProps) {
  const { accessToken, refresh, user } = useAuthSession();
  const [draft, setDraft] = useState<ProfileDraft>(() => emptyDraft());
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!visible || !user) return;
    setDraft({
      avatarUrl: user.avatarUrl ?? "",
      firstName: user.firstName ?? "",
      lastName: user.lastName ?? "",
      locale: user.locale ?? "en-US",
      timezone: user.timezone ?? currentTimeZone(),
    });
    setError("");
    setSaving(false);
    setStep(0);
  }, [user, visible]);

  const initials = useMemo(() => {
    if (!user) return "";
    return `${draft.firstName[0] ?? ""}${draft.lastName[0] ?? ""}`.trim().toUpperCase() || user.email.slice(0, 2).toUpperCase();
  }, [draft.firstName, draft.lastName, user]);

  if (!user) return null;

  function patch(next: Partial<ProfileDraft>) {
    setDraft((current) => ({ ...current, ...next }));
  }

  function validateIdentity() {
    if (!draft.firstName.trim()) return "First name is required.";
    if (!draft.lastName.trim()) return "Last name is required.";
    return "";
  }

  function nextStep() {
    const message = validateIdentity();
    if (message) {
      setError(message);
      return;
    }
    setError("");
    setStep(1);
  }

  async function save() {
    if (!accessToken) return;
    const message = validateIdentity();
    if (message) {
      setStep(0);
      setError(message);
      return;
    }

    setSaving(true);
    setError("");
    try {
      await updateMyProfile(accessToken, {
        avatarUrl: draft.avatarUrl.trim() || undefined,
        firstName: draft.firstName.trim(),
        lastName: draft.lastName.trim(),
        locale: draft.locale.trim() || undefined,
        timezone: draft.timezone.trim() || undefined,
      });
      await refresh();
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal animationType="slide" onRequestClose={onClose} presentationStyle="overFullScreen" transparent visible={visible}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.backdrop}>
        <Pressable accessibilityRole="button" onPress={onClose} style={styles.scrim} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.titleWrap}>
              <Text style={styles.eyebrow}>Profile</Text>
              <Text style={styles.title}>Edit profile</Text>
              <Text style={styles.subtitle}>{steps[step]?.title ?? steps[0].title}</Text>
            </View>
            <Pressable accessibilityRole="button" onPress={onClose} style={styles.closeButton}>
              <X color={colors.foreground} size={20} strokeWidth={2.8} />
            </Pressable>
          </View>

          <StepIndicator currentStep={step} />

          <ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {step === 0 ? (
              <IdentityStep
                draft={draft}
                email={user.email}
                initials={initials}
                internalEmail={user.internalEmail ?? user.internalMailbox?.address ?? null}
                onChange={patch}
              />
            ) : (
              <SettingsStep draft={draft} onChange={patch} />
            )}
          </ScrollView>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.footer}>
            {step > 0 ? (
              <Button
                label="Back"
                leftIcon={<ArrowLeft color={colors.black} size={16} strokeWidth={2.8} />}
                onPress={() => {
                  setError("");
                  setStep(0);
                }}
                style={styles.secondaryAction}
                variant="outline"
              />
            ) : null}
            <Button
              label={step === steps.length - 1 ? "Save profile" : "Continue"}
              loading={saving}
              onPress={step === steps.length - 1 ? save : nextStep}
              rightIcon={<ArrowRight color={colors.black} size={16} strokeWidth={2.8} />}
              style={styles.primaryAction}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function IdentityStep({
  draft,
  email,
  initials,
  internalEmail,
  onChange,
}: {
  draft: ProfileDraft;
  email: string;
  initials: string;
  internalEmail?: string | null;
  onChange: (next: Partial<ProfileDraft>) => void;
}) {
  return (
    <SectionCard
      description="Keep your name and avatar accurate across project activity, task ownership, and notifications."
      icon={<UserRound color={colors.foreground} size={18} strokeWidth={2.6} />}
      title="Profile basics"
    >
      <View style={styles.avatarPanel}>
        <View style={styles.avatarPreview}>
          {draft.avatarUrl.trim() ? <Image source={{ uri: draft.avatarUrl.trim() }} style={styles.avatarImage} /> : <Text style={styles.avatarInitials}>{initials}</Text>}
        </View>
        <View style={styles.avatarText}>
          <Text style={styles.avatarTitle}>{draft.firstName || "Your"} {draft.lastName || "profile"}</Text>
          <Text numberOfLines={1} style={styles.avatarEmail}>{internalEmail ?? email}</Text>
        </View>
      </View>
      <View style={styles.nameGrid}>
        <View style={styles.flex}>
          <Field
            autoCapitalize="words"
            label="First name"
            onChangeText={(firstName) => onChange({ firstName })}
            placeholder="Ada"
            value={draft.firstName}
          />
        </View>
        <View style={styles.flex}>
          <Field
            autoCapitalize="words"
            label="Last name"
            onChangeText={(lastName) => onChange({ lastName })}
            placeholder="Lovelace"
            value={draft.lastName}
          />
        </View>
      </View>
      <Field
        autoCapitalize="none"
        helperText="Paste a hosted image URL. If empty, TaskBricks uses initials."
        label="Avatar URL"
        leftAccessory={<ImageIcon color={colors.inkSoft} size={18} strokeWidth={2.5} />}
        onChangeText={(avatarUrl) => onChange({ avatarUrl })}
        placeholder="https://cdn.example.com/avatar.png"
        value={draft.avatarUrl}
      />
      <View style={styles.readOnlyField}>
        <Mail color={colors.inkSoft} size={18} strokeWidth={2.5} />
        <View style={styles.readOnlyText}>
          <Text style={styles.readOnlyLabel}>Workspace mail</Text>
          <Text numberOfLines={1} style={styles.readOnlyValue}>{internalEmail ?? "Creating workspace mail..."}</Text>
        </View>
      </View>
      <View style={styles.readOnlyField}>
        <Mail color={colors.inkSoft} size={18} strokeWidth={2.5} />
        <View style={styles.readOnlyText}>
          <Text style={styles.readOnlyLabel}>Login email</Text>
          <Text numberOfLines={1} style={styles.readOnlyValue}>{email}</Text>
        </View>
      </View>
    </SectionCard>
  );
}

function SettingsStep({ draft, onChange }: { draft: ProfileDraft; onChange: (next: Partial<ProfileDraft>) => void }) {
  return (
    <SectionCard
      description="These settings help dates, calendars, and notifications show correctly on mobile."
      icon={<Globe2 color={colors.foreground} size={18} strokeWidth={2.6} />}
      title="Regional settings"
    >
      <Field
        autoCapitalize="none"
        helperText="Example: America/Chicago"
        label="Timezone"
        onChangeText={(timezone) => onChange({ timezone })}
        placeholder="America/Chicago"
        value={draft.timezone}
      />
      <Field
        autoCapitalize="none"
        helperText="Example: en-US"
        label="Locale"
        onChangeText={(locale) => onChange({ locale })}
        placeholder="en-US"
        value={draft.locale}
      />
      <View style={styles.quickSettings}>
        <QuickSetting label="Use device timezone" onPress={() => onChange({ timezone: currentTimeZone() })} />
        <QuickSetting label="Use en-US" onPress={() => onChange({ locale: "en-US" })} />
      </View>
    </SectionCard>
  );
}

function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <View style={styles.steps}>
      {steps.map((item, index) => {
        const active = index === currentStep;
        const complete = index < currentStep;
        return (
          <View key={item.label} style={styles.stepItem}>
            <View style={[styles.stepCircle, active ? styles.stepCircleActive : null, complete ? styles.stepCircleComplete : null]}>
              {complete ? (
                <Check color={colors.white} size={14} strokeWidth={3} />
              ) : (
                <Text style={[styles.stepNumber, active ? styles.stepNumberActive : null]}>{index + 1}</Text>
              )}
            </View>
            <Text style={[styles.stepLabel, active ? styles.stepLabelActive : null]}>{item.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

function SectionCard({ children, description, icon, title }: { children: ReactNode; description: string; icon: ReactNode; title: string }) {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionIcon}>{icon}</View>
        <View style={styles.sectionText}>
          <Text style={styles.sectionTitle}>{title}</Text>
          <Text style={styles.sectionDescription}>{description}</Text>
        </View>
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function QuickSetting({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.quickSetting}>
      <Text style={styles.quickSettingText}>{label}</Text>
    </Pressable>
  );
}

function emptyDraft(): ProfileDraft {
  return { avatarUrl: "", firstName: "", lastName: "", locale: "en-US", timezone: currentTimeZone() };
}

function currentTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

const styles = StyleSheet.create(withFontStyles({
  avatarEmail: {
    color: colors.inkSoft,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 2,
  },
  avatarImage: {
    height: "100%",
    width: "100%",
  },
  avatarInitials: {
    color: colors.black,
    fontSize: 20,
    fontWeight: "900",
  },
  avatarPanel: {
    alignItems: "center",
    backgroundColor: colors.panelMuted,
    borderColor: colors.line,
    borderRadius: radii.xl,
    borderWidth: 1,
    flexDirection: "row",
    gap: 14,
    padding: 14,
  },
  avatarPreview: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 24,
    height: 58,
    justifyContent: "center",
    overflow: "hidden",
    width: 58,
  },
  avatarText: {
    flex: 1,
    minWidth: 0,
  },
  avatarTitle: {
    color: colors.foreground,
    fontSize: 17,
    fontWeight: "900",
  },
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
  },
  closeButton: {
    alignItems: "center",
    backgroundColor: colors.panelMuted,
    borderRadius: 18,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  errorBox: {
    backgroundColor: colors.redSoft,
    borderColor: "#fecaca",
    borderRadius: radii.lg,
    borderWidth: 1,
    marginTop: 14,
    padding: 12,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18,
  },
  eyebrow: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
  footer: {
    flexDirection: "row",
    gap: 10,
    paddingTop: 16,
  },
  formContent: {
    paddingBottom: 4,
  },
  handle: {
    alignSelf: "center",
    backgroundColor: colors.line,
    borderRadius: 999,
    height: 4,
    marginBottom: 18,
    width: 42,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: 14,
  },
  nameGrid: {
    flexDirection: "row",
    gap: 10,
  },
  primaryAction: {
    flex: 1,
  },
  quickSetting: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  quickSettings: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  quickSettingText: {
    color: colors.foreground,
    fontSize: 12,
    fontWeight: "900",
  },
  readOnlyField: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    minHeight: 58,
    paddingHorizontal: 14,
  },
  readOnlyLabel: {
    color: colors.inkSoft,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  readOnlyText: {
    flex: 1,
    minWidth: 0,
  },
  readOnlyValue: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: "900",
    marginTop: 2,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(16,16,15,0.34)",
  },
  secondaryAction: {
    flex: 0.75,
  },
  sectionBody: {
    gap: 18,
  },
  sectionCard: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: radii["2xl"],
    borderWidth: 1,
    gap: 20,
    padding: 20,
    ...shadow.card,
  },
  sectionDescription: {
    color: colors.inkSoft,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
    marginTop: 3,
  },
  sectionHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12,
  },
  sectionIcon: {
    alignItems: "center",
    backgroundColor: colors.panelMuted,
    borderRadius: 16,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  sectionText: {
    flex: 1,
    minWidth: 0,
  },
  sectionTitle: {
    color: colors.foreground,
    fontSize: 17,
    fontWeight: "900",
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    maxHeight: "94%",
    padding: 22,
    paddingBottom: 24,
    ...shadow.heavy,
  },
  stepCircle: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    height: 30,
    justifyContent: "center",
    width: 30,
  },
  stepCircleActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryDark,
  },
  stepCircleComplete: {
    backgroundColor: colors.foreground,
    borderColor: colors.foreground,
  },
  stepItem: {
    alignItems: "center",
    flex: 1,
    gap: 7,
  },
  stepLabel: {
    color: colors.inkSoft,
    fontSize: 11,
    fontWeight: "900",
  },
  stepLabelActive: {
    color: colors.foreground,
  },
  stepNumber: {
    color: colors.inkSoft,
    fontSize: 12,
    fontWeight: "900",
  },
  stepNumberActive: {
    color: colors.black,
  },
  steps: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 18,
    marginTop: 22,
  },
  subtitle: {
    color: colors.inkSoft,
    fontSize: 13,
    fontWeight: "800",
    marginTop: 3,
  },
  title: {
    color: colors.foreground,
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: 0,
    lineHeight: 32,
  },
  titleWrap: {
    flex: 1,
    minWidth: 0,
  },
}));
