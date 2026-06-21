import { Redirect, Tabs } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { CalendarDays, FolderOpen, LayoutDashboard, ListChecks, UserRound } from "lucide-react-native";
import { useAuthSession } from "@/lib/auth/AuthSessionProvider";
import { colors } from "@/lib/theme/tokens";

export default function WorkspaceTabsLayout() {
  const { initializing, user } = useAuthSession();

  if (initializing) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.foreground} />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.black,
        tabBarInactiveTintColor: colors.inkSoft,
        tabBarLabelStyle: styles.label,
        tabBarStyle: styles.tabBar,
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home", tabBarIcon: ({ color }) => <LayoutDashboard color={color} size={20} /> }} />
      <Tabs.Screen name="projects" options={{ title: "Projects", tabBarIcon: ({ color }) => <FolderOpen color={color} size={20} /> }} />
      <Tabs.Screen name="tasks" options={{ title: "Tasks", tabBarIcon: ({ color }) => <ListChecks color={color} size={20} /> }} />
      <Tabs.Screen name="meetings" options={{ title: "Meetings", tabBarIcon: ({ color }) => <CalendarDays color={color} size={20} /> }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: ({ color }) => <UserRound color={color} size={20} /> }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 11,
    fontWeight: "900",
  },
  loading: {
    alignItems: "center",
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: "center",
  },
  tabBar: {
    backgroundColor: colors.white,
    borderTopColor: colors.line,
    height: 78,
    paddingBottom: 16,
    paddingTop: 8,
  },
});
