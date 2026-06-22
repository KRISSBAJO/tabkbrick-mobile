import { Bell, Search } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radii, shadow } from "@/lib/theme/tokens";
import type { AuthUser } from "@/lib/types";

type WorkspaceHeaderProps = {
  user: AuthUser;
};

export function WorkspaceHeader({ user }: WorkspaceHeaderProps) {
  const displayName = `${user.firstName} ${user.lastName}`.trim() || user.email;
  const initials = `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`.trim() || user.email.slice(0, 2).toUpperCase();

  return (
    <View style={styles.wrap}>
      <View style={styles.identity}>
        <Text numberOfLines={1} style={styles.name}>{displayName}</Text>
        <Text numberOfLines={1} style={styles.role}>{user.roles[0] ?? "Workspace"}</Text>
      </View>
      <Pressable accessibilityRole="button" style={styles.iconButton}>
        <Search color={colors.inkSoft} size={18} />
      </Pressable>
      <Pressable accessibilityRole="button" style={styles.iconButton}>
        <Bell color={colors.inkSoft} size={18} />
      </Pressable>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initials}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  avatarText: {
    color: colors.black,
    fontSize: 12,
    fontWeight: "900",
  },
  iconButton: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: radii.lg,
    borderWidth: 1,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  identity: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    color: colors.foreground,
    fontSize: 17,
    fontWeight: "900",
  },
  role: {
    color: colors.inkSoft,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 1,
  },
  wrap: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: radii["2xl"],
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    padding: 10,
    ...shadow.card,
  },
});
