import { Redirect, Tabs } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { BriefcaseBusiness, CalendarDays, LayoutDashboard, ListChecks, UserRound } from "lucide-react-native";
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
        tabBarActiveBackgroundColor: colors.blueSoft,
        tabBarActiveTintColor: colors.accent,
        tabBarHideOnKeyboard: true,
        tabBarInactiveTintColor: colors.inkSoft,
        tabBarItemStyle: styles.tabItem,
        tabBarLabelStyle: styles.label,
        tabBarStyle: styles.tabBar,
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Projects", tabBarIcon: ({ color }) => <LayoutDashboard color={color} size={20} /> }} />
      <Tabs.Screen name="portfolio" options={{ title: "Portfolio", tabBarIcon: ({ color }) => <BriefcaseBusiness color={color} size={20} /> }} />
      <Tabs.Screen name="projects" options={{ href: null }} />
      <Tabs.Screen name="tasks" options={{ title: "Work", tabBarIcon: ({ color }) => <ListChecks color={color} size={20} /> }} />
      <Tabs.Screen name="meetings" options={{ title: "Planner", tabBarIcon: ({ color }) => <CalendarDays color={color} size={20} /> }} />
      <Tabs.Screen name="profile" options={{ title: "Account", tabBarIcon: ({ color }) => <UserRound color={color} size={20} /> }} />
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
    backgroundColor: "rgba(255,255,255,0.98)",
    borderColor: "rgba(16,16,15,0.06)",
    borderRadius: 34,
    borderTopColor: "rgba(16,16,15,0.06)",
    borderWidth: 1,
    bottom: 18,
    height: 66,
    left: 20,
    paddingBottom: 8,
    paddingHorizontal: 8,
    paddingTop: 8,
    position: "absolute",
    right: 20,
    shadowColor: "#111111",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 26,
    elevation: 8,
  },
  tabItem: {
    borderRadius: 26,
    marginHorizontal: 2,
  },
});
