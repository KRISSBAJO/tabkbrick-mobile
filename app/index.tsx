import { Redirect } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useAuthSession } from "@/lib/auth/AuthSessionProvider";
import { colors } from "@/lib/theme/tokens";

export default function IndexRoute() {
  const { initializing, user } = useAuthSession();

  if (initializing) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.foreground} />
      </View>
    );
  }

  return <Redirect href={user ? "/(workspace)" : "/entrance"} />;
}

const styles = StyleSheet.create({
  loading: {
    alignItems: "center",
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: "center",
  },
});
