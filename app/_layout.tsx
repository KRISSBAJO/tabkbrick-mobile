import "react-native-gesture-handler";
import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AuthSessionProvider } from "@/lib/auth/AuthSessionProvider";
import { colors } from "@/lib/theme/tokens";

export default function RootLayout() {
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(colors.background);
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthSessionProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="login" />
          <Stack.Screen name="signup" />
          <Stack.Screen name="(workspace)" />
        </Stack>
      </AuthSessionProvider>
    </GestureHandlerRootView>
  );
}
