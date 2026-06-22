import type { ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Activity, AlertTriangle, BriefcaseBusiness, CircleDollarSign, TrendingUp } from "lucide-react-native";
import { StatusPill } from "@/components/ui/StatusPill";
import { colors, radii, shadow } from "@/lib/theme/tokens";

const programs = [
  { name: "Platform modernization", owner: "Delivery office", progress: 68, status: "On track", tone: "green" as const },
  { name: "Customer operations", owner: "Experience team", progress: 44, status: "Watch", tone: "yellow" as const },
  { name: "Security readiness", owner: "Risk council", progress: 81, status: "Strong", tone: "green" as const },
];

const signals = [
  { label: "Delivery health", value: "84%", tone: colors.success },
  { label: "Budget used", value: "$1.8M", tone: colors.foreground },
  { label: "At-risk work", value: "6", tone: colors.warning },
];

const milestones = [
  "Mobile project controls",
  "Realtime access hardening",
  "OpenAPI contract lock",
];

export default function PortfolioScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Portfolio</Text>
          <Text style={styles.subtitle}>Mock executive view while the real portfolio API is wired in.</Text>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <BriefcaseBusiness color={colors.foreground} size={22} strokeWidth={2.7} />
          </View>
          <View style={styles.heroText}>
            <Text style={styles.heroTitle}>Q3 delivery portfolio</Text>
            <Text style={styles.heroMeta}>18 active initiatives - 4 strategic programs</Text>
          </View>
          <StatusPill label="Mock" tone="blue" />
        </View>

        <View style={styles.signalGrid}>
          {signals.map((signal) => (
            <View key={signal.label} style={styles.signalCard}>
              <Text style={[styles.signalValue, { color: signal.tone }]}>{signal.value}</Text>
              <Text style={styles.signalLabel}>{signal.label}</Text>
            </View>
          ))}
        </View>

        <SectionTitle title="Program Health" />
        <View style={styles.programList}>
          {programs.map((program) => (
            <View key={program.name} style={styles.programRow}>
              <View style={styles.programTop}>
                <View style={styles.programText}>
                  <Text style={styles.programTitle}>{program.name}</Text>
                  <Text style={styles.programOwner}>{program.owner}</Text>
                </View>
                <StatusPill label={program.status} tone={program.tone} />
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${program.progress}%` }]} />
              </View>
            </View>
          ))}
        </View>

        <SectionTitle title="Portfolio Signals" />
        <View style={styles.insightGrid}>
          <Insight icon={<TrendingUp color={colors.success} size={18} />} label="Momentum" value="Three programs trending up" />
          <Insight icon={<AlertTriangle color={colors.warning} size={18} />} label="Risk" value="Budget pressure in operations" />
          <Insight icon={<Activity color={colors.accent} size={18} />} label="Focus" value="Mobile delivery is the active push" />
          <Insight icon={<CircleDollarSign color={colors.foreground} size={18} />} label="Finance" value="Forecast review due Friday" />
        </View>

        <SectionTitle title="Next Milestones" />
        <View style={styles.milestoneList}>
          {milestones.map((milestone, index) => (
            <View key={milestone} style={styles.milestoneRow}>
              <View style={styles.milestoneNumber}>
                <Text style={styles.milestoneNumberText}>{index + 1}</Text>
              </View>
              <Text style={styles.milestoneText}>{milestone}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function Insight({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <View style={styles.insightCard}>
      <View style={styles.insightIcon}>{icon}</View>
      <Text style={styles.insightLabel}>{label}</Text>
      <Text style={styles.insightValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 20,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 116,
  },
  header: {
    gap: 3,
  },
  hero: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: radii["2xl"],
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    padding: 18,
    ...shadow.card,
  },
  heroIcon: {
    alignItems: "center",
    backgroundColor: colors.yellowSoft,
    borderRadius: 18,
    height: 46,
    justifyContent: "center",
    width: 46,
  },
  heroMeta: {
    color: colors.inkSoft,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 3,
  },
  heroText: {
    flex: 1,
    minWidth: 0,
  },
  heroTitle: {
    color: colors.foreground,
    fontSize: 17,
    fontWeight: "900",
  },
  insightCard: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: radii.xl,
    borderWidth: 1,
    flexBasis: "48%",
    flexGrow: 1,
    gap: 6,
    minHeight: 128,
    padding: 15,
  },
  insightGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  insightIcon: {
    alignItems: "center",
    backgroundColor: colors.panelMuted,
    borderRadius: 15,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  insightLabel: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: "900",
  },
  insightValue: {
    color: colors.inkSoft,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
  },
  milestoneList: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: radii.xl,
    borderWidth: 1,
    overflow: "hidden",
  },
  milestoneNumber: {
    alignItems: "center",
    backgroundColor: colors.blueSoft,
    borderRadius: 14,
    height: 28,
    justifyContent: "center",
    width: 28,
  },
  milestoneNumberText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "900",
  },
  milestoneRow: {
    alignItems: "center",
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 12,
    minHeight: 58,
    paddingHorizontal: 16,
  },
  milestoneText: {
    color: colors.foreground,
    flex: 1,
    fontSize: 14,
    fontWeight: "800",
  },
  programList: {
    gap: 10,
  },
  programOwner: {
    color: colors.inkSoft,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 3,
  },
  programRow: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: radii.xl,
    borderWidth: 1,
    gap: 14,
    padding: 16,
  },
  programText: {
    flex: 1,
    minWidth: 0,
  },
  programTitle: {
    color: colors.foreground,
    fontSize: 15,
    fontWeight: "900",
  },
  programTop: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  progressFill: {
    backgroundColor: colors.accent,
    borderRadius: 999,
    height: 7,
  },
  progressTrack: {
    backgroundColor: colors.panelMuted,
    borderRadius: 999,
    height: 7,
    overflow: "hidden",
  },
  safe: {
    backgroundColor: colors.background,
    flex: 1,
  },
  sectionTitle: {
    color: colors.slate,
    fontSize: 14,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  signalCard: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: radii.xl,
    borderWidth: 1,
    flex: 1,
    gap: 3,
    minWidth: 0,
    padding: 14,
  },
  signalGrid: {
    flexDirection: "row",
    gap: 10,
  },
  signalLabel: {
    color: colors.inkSoft,
    fontSize: 11,
    fontWeight: "900",
    lineHeight: 15,
    textTransform: "uppercase",
  },
  signalValue: {
    fontSize: 23,
    fontWeight: "900",
  },
  subtitle: {
    color: colors.inkSoft,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18,
  },
  title: {
    color: colors.foreground,
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: 0,
    lineHeight: 38,
  },
});
