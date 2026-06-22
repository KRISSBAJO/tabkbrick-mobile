import { ArrowRight, CalendarDays, FolderKanban } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { StatusPill } from "@/components/ui/StatusPill";
import { formatDate, humanize, projectHealth, statusTone, summarizeProject } from "@/features/projects/projectFormat";
import { colors, radii } from "@/lib/theme/tokens";
import type { Project } from "@/lib/types";

type ProjectCardProps = {
  onPress: () => void;
  project: Project;
};

export function ProjectCard({ onPress, project }: ProjectCardProps) {
  const health = projectHealth(project);

  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.card, pressed ? styles.pressed : null]}>
      <View style={styles.topRow}>
        <View style={styles.icon}>
          <FolderKanban color={colors.accent} size={18} strokeWidth={2.6} />
        </View>
        <View style={styles.titleWrap}>
          <Text numberOfLines={1} style={styles.title}>{project.name}</Text>
          <Text numberOfLines={1} style={styles.meta}>{project.key} - {summarizeProject(project)}</Text>
        </View>
        <ArrowRight color={colors.inkSoft} size={18} />
      </View>

      {project.description ? <Text numberOfLines={2} style={styles.description}>{project.description}</Text> : null}

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${Math.min(Math.max(project.progress ?? 0, 0), 100)}%` }]} />
      </View>

      <View style={styles.bottomRow}>
        <View style={styles.date}>
          <CalendarDays color={colors.inkSoft} size={15} />
          <Text style={styles.dateText}>{formatDate(project.dueDate)}</Text>
        </View>
        <View style={styles.pills}>
          <StatusPill label={humanize(project.status)} tone={statusTone(project.status)} />
          <StatusPill label={health.label} tone={health.tone} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bottomRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
  },
  card: {
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: 14,
    padding: 15,
  },
  date: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
  },
  dateText: {
    color: colors.inkSoft,
    fontSize: 12,
    fontWeight: "800",
  },
  description: {
    color: colors.inkSoft,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
  },
  icon: {
    alignItems: "center",
    backgroundColor: colors.blueSoft,
    borderRadius: radii.md,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  meta: {
    color: colors.inkSoft,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 2,
  },
  pills: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
  },
  pressed: {
    transform: [{ translateY: 1 }],
  },
  progressFill: {
    backgroundColor: colors.accent,
    borderRadius: 99,
    height: 7,
  },
  progressTrack: {
    backgroundColor: colors.panelMuted,
    borderRadius: 99,
    height: 7,
    overflow: "hidden",
  },
  title: {
    color: colors.foreground,
    fontSize: 16,
    fontWeight: "900",
  },
  titleWrap: {
    flex: 1,
    minWidth: 0,
  },
  topRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
});
