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
        tabBarActiveBackgroundColor: colors.primary,
        tabBarActiveTintColor: colors.black,
        tabBarHideOnKeyboard: true,
        tabBarInactiveTintColor: "rgba(255,255,255,0.72)",
        tabBarItemStyle: styles.tabItem,
        tabBarLabelStyle: styles.label,
        tabBarStyle: styles.tabBar,
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home", tabBarIcon: ({ color }) => <LayoutDashboard color={color} size={20} /> }} />
      <Tabs.Screen name="projects" options={{ title: "Projects", tabBarIcon: ({ color }) => <FolderOpen color={color} size={20} /> }} />
      <Tabs.Screen name="projects/[projectId]" options={{ href: null }} />
      <Tabs.Screen name="projects/new" options={{ href: null }} />
      <Tabs.Screen name="tasks" options={{ title: "Tasks", tabBarIcon: ({ color }) => <ListChecks color={color} size={20} /> }} />
      <Tabs.Screen name="meetings" options={{ title: "Meetings", tabBarIcon: ({ color }) => <CalendarDays color={color} size={20} /> }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: ({ color }) => <UserRound color={color} size={20} /> }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 10,
    fontWeight: "900",
    marginTop: 2,
  },
  loading: {
    alignItems: "center",
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: "center",
  },
  tabBar: {
    backgroundColor: colors.black,
    borderColor: "rgba(255,255,255,0.06)",
    borderRadius: 30,
    borderTopColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    bottom: 18,
    height: 64,
    left: 20,
    paddingBottom: 8,
    paddingHorizontal: 8,
    paddingTop: 8,
    position: "absolute",
    right: 20,
  },
  tabItem: {
    borderRadius: 24,
    marginHorizontal: 2,
  },
});
