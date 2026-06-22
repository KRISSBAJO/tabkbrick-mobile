import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/ui/Screen";
import { StatusPill } from "@/components/ui/StatusPill";
import { Surface } from "@/components/ui/Surface";
import { useAuthSession } from "@/lib/auth/AuthSessionProvider";
import { colors, radii } from "@/lib/theme/tokens";

export type ResourceItem = {
  description?: string | null;
  id: string;
  status?: string | null;
  title: string;
};

type ResourceListScreenProps = {
  emptyText: string;
  load: (token: string) => Promise<ResourceItem[]>;
  title: string;
};

export function ResourceListScreen({ emptyText, load, title }: ResourceListScreenProps) {
  const { accessToken } = useAuthSession();
  const [items, setItems] = useState<ResourceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    if (!accessToken) return undefined;

    setLoading(true);
    setError("");
    void load(accessToken)
      .then((next) => {
        if (alive) setItems(next);
      })
      .catch((caught) => {
        if (alive) setError(caught instanceof Error ? caught.message : "Unable to load records.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [accessToken, load]);

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Workspace</Text>
        <Text style={styles.screenTitle}>{title}</Text>
      </View>
      <Surface>
        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.foreground} />
            <Text style={styles.muted}>Loading</Text>
          </View>
        ) : error ? (
          <Text style={styles.error}>{error}</Text>
        ) : items.length ? (
          <View style={styles.list}>
            {items.map((item) => (
              <View key={item.id} style={styles.row}>
                <View style={styles.rowText}>
                  <Text numberOfLines={1} style={styles.title}>{item.title}</Text>
                  {item.description ? <Text numberOfLines={1} style={styles.description}>{item.description}</Text> : null}
                </View>
                {item.status ? <StatusPill label={item.status.replace(/_/g, " ")} tone={toneFromStatus(item.status)} /> : null}
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.muted}>{emptyText}</Text>
        )}
      </Surface>
    </Screen>
  );
}

function toneFromStatus(status: string): "green" | "red" | "yellow" | "neutral" {
  if (/done|active|confirmed|completed/i.test(status)) return "green";
  if (/blocked|cancelled|failed|overdue/i.test(status)) return "red";
  if (/progress|review|scheduled|pending/i.test(status)) return "yellow";
  return "neutral";
}

const styles = StyleSheet.create({
  description: {
    color: colors.inkSoft,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 3,
  },
  error: {
    backgroundColor: colors.redSoft,
    borderColor: "#fecaca",
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.danger,
    fontSize: 13,
    fontWeight: "800",
    padding: 12,
  },
  eyebrow: {
    color: colors.primaryDark,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  header: {
    gap: 3,
  },
  list: {
    gap: 10,
  },
  loading: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    paddingVertical: 8,
  },
  muted: {
    color: colors.inkSoft,
    fontSize: 13,
    fontWeight: "700",
  },
  row: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    padding: 12,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: "900",
  },
  screenTitle: {
    color: colors.foreground,
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: 0,
  },
});
