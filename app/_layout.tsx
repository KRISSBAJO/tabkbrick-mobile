import "react-native-gesture-handler";
import { useEffect } from "react";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AuthSessionProvider } from "@/lib/auth/AuthSessionProvider";
import { installGlobalFontDefaults } from "@/lib/theme/fontDefaults";
import { colors, fonts } from "@/lib/theme/tokens";

installGlobalFontDefaults();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    [fonts.regular]: require("@expo-google-fonts/plus-jakarta-sans/400Regular/PlusJakartaSans_400Regular.ttf"),
    [fonts.medium]: require("@expo-google-fonts/plus-jakarta-sans/500Medium/PlusJakartaSans_500Medium.ttf"),
    [fonts.semiBold]: require("@expo-google-fonts/plus-jakarta-sans/600SemiBold/PlusJakartaSans_600SemiBold.ttf"),
    [fonts.bold]: require("@expo-google-fonts/plus-jakarta-sans/700Bold/PlusJakartaSans_700Bold.ttf"),
    [fonts.extraBold]: require("@expo-google-fonts/plus-jakarta-sans/800ExtraBold/PlusJakartaSans_800ExtraBold.ttf"),
  });

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(colors.background);
  }, []);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthSessionProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="entrance" />
          <Stack.Screen name="login" />
          <Stack.Screen name="signup" />
          <Stack.Screen name="(workspace)" />
        </Stack>
      </AuthSessionProvider>
    </GestureHandlerRootView>
  );
}
