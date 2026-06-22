import { router } from "expo-router";
import { StyleSheet, View } from "react-native";
import { ProjectCreateModal } from "@/features/projects/ProjectCreateModal";
import { colors } from "@/lib/theme/tokens";
import type { Project } from "@/lib/types";

export default function NewProjectScreen() {
  function close() {
    router.canGoBack() ? router.back() : router.replace("/(workspace)/projects");
  }

  function created(project: Project) {
    router.replace({ pathname: "/(workspace)/projects/[projectId]", params: { projectId: project.id } });
  }

  return (
    <View style={styles.safe}>
      <ProjectCreateModal onClose={close} onCreated={created} visible />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    backgroundColor: colors.background,
    flex: 1,
  },
});
