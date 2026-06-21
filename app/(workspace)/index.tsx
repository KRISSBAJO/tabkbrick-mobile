import { BarChart3, CalendarDays, FolderOpen, ListChecks } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/ui/Screen";
import { StatusPill } from "@/components/ui/StatusPill";
import { Surface } from "@/components/ui/Surface";
import { MetricCard } from "@/features/workspace/MetricCard";
import { WorkspaceHeader } from "@/features/workspace/WorkspaceHeader";
import { useAuthSession } from "@/lib/auth/AuthSessionProvider";
import { colors, radii } from "@/lib/theme/tokens";

const workQueue = [
  { label: "Board review", meta: "Product launch / 8 tasks", tone: "yellow" as const },
  { label: "Client kickoff", meta: "Today, 14:00", tone: "blue" as const },
  { label: "Risk register", meta: "3 open high-priority risks", tone: "red" as const },
];

export default function DashboardScreen() {
  const { user } = useAuthSession();

  if (!user) return null;

  return (
    <Screen>
      <WorkspaceHeader user={user} />

      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Command center</Text>
        <Text style={styles.title}>Good to see you, {user.firstName || "there"}.</Text>
        <Text style={styles.subtitle}>Your delivery queue is organized by work that needs attention first.</Text>
      </View>

      <View style={styles.metrics}>
        <MetricCard icon={FolderOpen} label="Active projects" tone="dark" value="12" />
        <MetricCard icon={ListChecks} label="Tasks moving" tone="yellow" value="38" />
      </View>
      <View style={styles.metrics}>
        <MetricCard icon={CalendarDays} label="Meetings today" value="4" />
        <MetricCard icon={BarChart3} label="At-risk work" value="3" />
      </View>

      <Surface eyebrow="Priority" title="Work queue">
        <View style={styles.queue}>
          {workQueue.map((item) => (
            <View key={item.label} style={styles.queueRow}>
              <View style={styles.queueText}>
                <Text style={styles.queueTitle}>{item.label}</Text>
                <Text style={styles.queueMeta}>{item.meta}</Text>
              </View>
              <StatusPill label="Open" tone={item.tone} />
            </View>
          ))}
        </View>
      </Surface>
    </Screen>
  );
}

const styles = StyleSheet.create({
  eyebrow: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0,
    textTransform: "uppercase",
  },
  hero: {
    backgroundColor: colors.black,
    borderRadius: radii["2xl"],
    gap: 8,
    padding: 20,
  },
  metrics: {
    flexDirection: "row",
    gap: 12,
  },
  queue: {
    gap: 10,
  },
  queueMeta: {
    color: colors.inkSoft,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 3,
  },
  queueRow: {
    alignItems: "center",
    backgroundColor: colors.muted,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    padding: 12,
  },
  queueText: {
    flex: 1,
  },
  queueTitle: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: "900",
  },
  subtitle: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
    maxWidth: 300,
  },
  title: {
    color: colors.white,
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: 0,
    lineHeight: 33,
    maxWidth: 300,
  },
});
