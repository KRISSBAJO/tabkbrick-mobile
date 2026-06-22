import { Stack } from "expo-router";

export default function ProjectsStackLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[projectId]" />
      <Stack.Screen name="new" />
    </Stack>
  );
}
