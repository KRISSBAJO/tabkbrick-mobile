import { useEffect, useRef, useState } from "react";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Redirect, Tabs, router, type Href, usePathname } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, Alert, Animated, PanResponder, Pressable, StyleSheet, Text, View } from "react-native";
import type { LucideIcon } from "lucide-react-native";
import {
  BookOpen,
  BriefcaseBusiness,
  CalendarDays,
  CheckSquare2,
  CreditCard,
  Flag,
  LayoutDashboard,
  MessageSquare,
  Plus,
  UsersRound,
  UserRound,
  X,
} from "lucide-react-native";
import { useAuthSession } from "@/lib/auth/AuthSessionProvider";
import { colors, radii } from "@/lib/theme/tokens";

const WHEEL_RADIUS = 90;
const ITEM_SIZE = 56;
const WHEEL_CONT = 256; // 2*(WHEEL_RADIUS+ITEM_SIZE/2) + 16 padding

type VisibleTab = {
  icon: (color: string) => React.ReactNode;
  label: string;
  path: Href;
  routeName: string;
};

type WheelItem = {
  bg: string;
  icon: LucideIcon;
  iconColor: string;
  label: string;
  path?: Href;
};

const sprintsIndexHref = "/(workspace)/sprints" as Href;

const visibleTabs: VisibleTab[] = [
  { icon: (c) => <LayoutDashboard color={c} size={20} strokeWidth={2.7} />, label: "Projects", path: "/(workspace)", routeName: "index" },
  { icon: (c) => <Flag color={c} size={20} strokeWidth={2.7} />, label: "Sprints", path: sprintsIndexHref, routeName: "sprints/index" },
  { icon: (c) => <CalendarDays color={c} size={20} strokeWidth={2.7} />, label: "Planner", path: "/(workspace)/meetings", routeName: "meetings" },
  { icon: (c) => <UserRound color={c} size={20} strokeWidth={2.7} />, label: "Account", path: "/(workspace)/profile", routeName: "profile" },
];

const wheelItems: WheelItem[] = [
  { bg: colors.blueSoft,   icon: BriefcaseBusiness, iconColor: colors.accent,       label: "Board",   path: "/(workspace)/portfolio" },
  { bg: colors.greenSoft,  icon: CheckSquare2,       iconColor: colors.success,      label: "Tasks",   path: "/(workspace)/tasks" },
  { bg: colors.yellowSoft, icon: MessageSquare,      iconColor: colors.primaryDark,  label: "Chat",    path: "/(workspace)/messages" },
  { bg: "#eef2ff",         icon: UsersRound,         iconColor: "#4f46e5",           label: "Team",    path: "/(workspace)/team" },
  { bg: colors.orangeSoft, icon: BookOpen,           iconColor: colors.warning,      label: "Docs",    path: "/(workspace)/docs" },
  { bg: "#f0e6ff",         icon: CreditCard,         iconColor: "#7c3aed",           label: "Billing", path: "/(workspace)/billing" },
];

export default function WorkspaceTabsLayout() {
  const { initializing, user } = useAuthSession();
  const pathname = usePathname();

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

  const lightStatusBar = pathname.startsWith("/messages") || pathname.startsWith("/ai");

  return (
    <>
      <StatusBar backgroundColor={lightStatusBar ? colors.black : colors.background} style={lightStatusBar ? "light" : "dark"} />
      <Tabs
        tabBar={(props) => <WorkspaceTabBar {...props} />}
        screenOptions={{ headerShown: false, tabBarHideOnKeyboard: true }}
      >
        <Tabs.Screen name="index"                 options={{ title: "Projects", tabBarIcon: ({ color }) => <LayoutDashboard color={color} size={20} /> }} />
        <Tabs.Screen name="portfolio"             options={{ href: null, title: "Board" }} />
        <Tabs.Screen name="projects"              options={{ href: null }} />
        <Tabs.Screen name="tasks/index"           options={{ href: null, title: "Tasks" }} />
        <Tabs.Screen name="ai"                    options={{ href: null, title: "AI" }} />
        <Tabs.Screen name="messages"              options={{ href: null, title: "Chat" }} />
        <Tabs.Screen name="approvals"             options={{ href: null, title: "Approvals" }} />
        <Tabs.Screen name="team"                  options={{ href: null, title: "Team" }} />
        <Tabs.Screen name="integrations"          options={{ href: null, title: "Integrations" }} />
        <Tabs.Screen name="developer-tools"       options={{ href: null, title: "Developer tools" }} />
        <Tabs.Screen name="billing"               options={{ href: null, title: "Billing" }} />
        <Tabs.Screen name="docs"                  options={{ href: null, title: "Docs" }} />
        <Tabs.Screen name="reports"               options={{ href: null, title: "Reports" }} />
        <Tabs.Screen name="account-workspaces"    options={{ href: null, title: "Your workspaces" }} />
        <Tabs.Screen name="guest-workspaces"      options={{ href: null, title: "Guest workspaces" }} />
        <Tabs.Screen name="manage-account"        options={{ href: null, title: "Manage account" }} />
        <Tabs.Screen name="security-center"       options={{ href: null, title: "Security center" }} />
        <Tabs.Screen name="help-support"          options={{ href: null, title: "Help and support" }} />
        <Tabs.Screen name="sprints/index"         options={{ title: "Sprints", tabBarIcon: ({ color }) => <Flag color={color} size={20} /> }} />
        <Tabs.Screen name="meetings"              options={{ title: "Planner", tabBarIcon: ({ color }) => <CalendarDays color={color} size={20} /> }} />
        <Tabs.Screen name="notifications"         options={{ href: null, title: "Notifications" }} />
        <Tabs.Screen name="notification-settings" options={{ href: null, title: "Notification settings" }} />
        <Tabs.Screen name="profile"               options={{ title: "Account", tabBarIcon: ({ color }) => <UserRound color={color} size={20} /> }} />
      </Tabs>
    </>
  );
}

// ─── Tab bar ─────────────────────────────────────────────────────────────────

function WorkspaceTabBar({ state }: BottomTabBarProps) {
  const [open, setOpen] = useState(false);
  const activeRouteName = state.routes[state.index]?.name;
  const leftTabs = visibleTabs.slice(0, 2);
  const rightTabs = visibleTabs.slice(2);

  function navigate(tab: VisibleTab) {
    setOpen(false);
    router.navigate(tab.path);
  }

  return (
    <View pointerEvents="box-none" style={styles.tabLayer}>
      {open ? (
        <Pressable accessibilityRole="button" onPress={() => setOpen(false)} style={styles.menuScrim} />
      ) : null}

      {open ? (
        <View pointerEvents="box-none" style={styles.wheelWrap}>
          <SpinningWheel onClose={() => setOpen(false)} />
        </View>
      ) : null}

      <View style={styles.tabBar}>
        <View style={styles.tabSide}>
          {leftTabs.map((tab) => (
            <TabItem
              active={activeRouteName === tab.routeName}
              icon={tab.icon}
              key={tab.routeName}
              label={tab.label}
              onPress={() => navigate(tab)}
            />
          ))}
        </View>

        <Pressable
          accessibilityLabel="Open workspace actions"
          accessibilityRole="button"
          onPress={() => setOpen((v) => !v)}
          style={[styles.centerAction, open ? styles.centerActionOpen : null]}
        >
          <Plus color={colors.black} size={29} strokeWidth={2.9} />
        </Pressable>

        <View style={styles.tabSide}>
          {rightTabs.map((tab) => (
            <TabItem
              active={activeRouteName === tab.routeName}
              icon={tab.icon}
              key={tab.routeName}
              label={tab.label}
              onPress={() => navigate(tab)}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

// ─── Spinning wheel ───────────────────────────────────────────────────────────

function SpinningWheel({ onClose }: { onClose: () => void }) {
  const rotDeg = useRef(new Animated.Value(0)).current;
  const rotVal = useRef(0);
  const rotAtGrant = useRef(0);
  const scaleAnim = useRef(new Animated.Value(0.5)).current;

  // Wheel rotation and per-item counter-rotation so labels stay upright
  const rotInterp = rotDeg.interpolate({
    inputRange: [-3600, 3600],
    outputRange: ["-3600deg", "3600deg"],
    extrapolate: "extend",
  });
  const counterRotInterp = rotDeg.interpolate({
    inputRange: [-3600, 3600],
    outputRange: ["3600deg", "-3600deg"],
    extrapolate: "extend",
  });

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      damping: 14,
      stiffness: 130,
    }).start();
    const listenerId = rotDeg.addListener(({ value }) => {
      rotVal.current = value;
    });
    return () => rotDeg.removeListener(listenerId);
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > 5 || Math.abs(gs.dy) > 5,
      onPanResponderGrant: () => {
        rotDeg.stopAnimation();
        rotAtGrant.current = rotVal.current;
      },
      onPanResponderMove: (_, gs) => {
        rotDeg.setValue(rotAtGrant.current + gs.dx * 0.65);
      },
      onPanResponderRelease: (_, gs) => {
        const projected = rotVal.current + gs.vx * 90;
        const snapped = Math.round(projected / 60) * 60;
        Animated.spring(rotDeg, {
          toValue: snapped,
          useNativeDriver: true,
          damping: 20,
          stiffness: 90,
          mass: 1,
        }).start();
      },
    })
  ).current;

  function handleItem(item: WheelItem) {
    if (item.path) {
      onClose();
      router.push(item.path);
    } else {
      Alert.alert(item.label, "Coming soon to mobile.");
    }
  }

  return (
    <Animated.View
      style={[styles.wheelContainer, { transform: [{ scale: scaleAnim }] }]}
      {...panResponder.panHandlers}
    >
      {/* Static disc background */}
      <View style={styles.wheelDisc} />

      {/* Rotating ring with items */}
      <Animated.View style={[styles.wheel, { transform: [{ rotate: rotInterp }] }]}>
        {wheelItems.map((item, index) => {
          const angleRad = (index * (360 / wheelItems.length) * Math.PI) / 180;
          const itemLeft = WHEEL_CONT / 2 - ITEM_SIZE / 2 + Math.sin(angleRad) * WHEEL_RADIUS;
          const itemTop  = WHEEL_CONT / 2 - ITEM_SIZE / 2 - Math.cos(angleRad) * WHEEL_RADIUS;
          return (
            <Animated.View
              key={item.label}
              style={{
                height: ITEM_SIZE,
                left: itemLeft,
                position: "absolute",
                top: itemTop,
                transform: [{ rotate: counterRotInterp }],
                width: ITEM_SIZE,
              }}
            >
              <Pressable
                accessibilityRole="button"
                onPress={() => handleItem(item)}
                style={[styles.wheelItem, { backgroundColor: item.bg }]}
              >
                <View style={[styles.wheelIconBox, { backgroundColor: item.iconColor }]}>
                  <item.icon color="#ffffff" size={16} strokeWidth={2.5} />
                </View>
                <Text style={styles.wheelItemLabel}>{item.label}</Text>
              </Pressable>
            </Animated.View>
          );
        })}
      </Animated.View>

      {/* Center close button — rendered last so it sits on top */}
      <Pressable
        accessibilityLabel="Close menu"
        accessibilityRole="button"
        onPress={onClose}
        style={styles.wheelCloseBtn}
      >
        <X color={colors.black} size={24} strokeWidth={2.9} />
      </Pressable>
    </Animated.View>
  );
}

// ─── Tab item ─────────────────────────────────────────────────────────────────

function TabItem({
  active,
  icon,
  label,
  onPress,
}: {
  active: boolean;
  icon: (color: string) => React.ReactNode;
  label: string;
  onPress: () => void;
}) {
  const tint = active ? colors.accent : colors.foreground;
  return (
    <Pressable
      accessibilityRole="button"
      hitSlop={8}
      onPress={onPress}
      style={[styles.tabItem, active ? styles.tabItemActive : null]}
    >
      {icon(tint)}
      <Text numberOfLines={1} style={[styles.label, active ? styles.labelActive : null]}>{label}</Text>
    </Pressable>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // ── Tab bar ──
  loading: {
    alignItems: "center",
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: "center",
  },
  tabLayer: {
    bottom: 18,
    left: 20,
    position: "absolute",
    right: 20,
  },
  menuScrim: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: -900,
    zIndex: 1,
  },
  tabBar: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.97)",
    borderColor: "rgba(16,16,15,0.06)",
    borderRadius: 34,
    borderWidth: 1,
    elevation: 8,
    flexDirection: "row",
    gap: 8,
    height: 66,
    paddingHorizontal: 12,
    shadowColor: "#111111",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 26,
  },
  tabSide: {
    flex: 1,
    flexDirection: "row",
    gap: 4,
  },
  tabItem: {
    alignItems: "center",
    borderRadius: 24,
    flex: 1,
    height: 50,
    justifyContent: "center",
    minWidth: 0,
  },
  tabItemActive: {
    backgroundColor: colors.blueSoft,
  },
  label: {
    color: colors.foreground,
    fontSize: 9,
    fontWeight: "900",
    marginTop: 3,
  },
  labelActive: {
    color: colors.accent,
  },
  centerAction: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: colors.primary,
    borderColor: "#10100f",
    borderRadius: 33,
    borderWidth: 8,
    elevation: 12,
    height: 66,
    justifyContent: "center",
    marginTop: -34,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.24,
    shadowRadius: 22,
    width: 66,
  },
  centerActionOpen: {
    transform: [{ rotate: "45deg" }],
  },

  // ── Spinning wheel ──
  wheelWrap: {
    alignSelf: "center",
    bottom: 82,
    elevation: 10,
    position: "absolute",
    zIndex: 2,
  },
  wheelContainer: {
    height: WHEEL_CONT,
    width: WHEEL_CONT,
  },
  wheelDisc: {
    backgroundColor: "rgba(255,255,255,0.96)",
    borderColor: "rgba(16,16,15,0.06)",
    borderRadius: WHEEL_CONT / 2,
    borderWidth: 1,
    bottom: 0,
    elevation: 10,
    left: 0,
    position: "absolute",
    right: 0,
    shadowColor: "#111111",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.14,
    shadowRadius: 40,
    top: 0,
  },
  wheel: {
    height: WHEEL_CONT,
    position: "absolute",
    width: WHEEL_CONT,
  },
  wheelItem: {
    alignItems: "center",
    borderRadius: radii.lg,
    elevation: 2,
    flex: 1,
    gap: 5,
    justifyContent: "center",
    shadowColor: "#111111",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  wheelIconBox: {
    alignItems: "center",
    borderRadius: 10,
    height: 28,
    justifyContent: "center",
    width: 28,
  },
  wheelItemLabel: {
    color: colors.foreground,
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  wheelCloseBtn: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderColor: "#10100f",
    borderRadius: 33,
    borderWidth: 8,
    elevation: 12,
    height: 66,
    justifyContent: "center",
    left: (WHEEL_CONT - 66) / 2,
    position: "absolute",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.24,
    shadowRadius: 22,
    top: (WHEEL_CONT - 66) / 2,
    width: 66,
  },
});
