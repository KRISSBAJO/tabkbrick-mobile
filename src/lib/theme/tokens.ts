export const colors = {
  background: "#f7f3ed",
  foreground: "#171511",
  panel: "#ffffff",
  panelMuted: "#fbf7ef",
  line: "#ece4d7",
  primary: "#ffd400",
  primaryDark: "#e7bc00",
  accent: "#2563eb",
  inkSoft: "#716b61",
  danger: "#b91c1c",
  warning: "#c26a1b",
  success: "#059669",
  black: "#10100f",
  white: "#ffffff",
  slate: "#35302a",
  muted: "#fbf8f1",
  blueSoft: "#eef4ff",
  greenSoft: "#ecfdf3",
  redSoft: "#fef2f2",
  yellowSoft: "#fff1d9",
  orangeSoft: "#fff3e8",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
} as const;

export const radii = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 22,
  "2xl": 28,
} as const;

export const typography = {
  title: 30,
  h1: 24,
  h2: 18,
  body: 15,
  small: 13,
  tiny: 11,
} as const;

export const shadow = {
  card: {
    shadowColor: "#111111",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.06,
    shadowRadius: 28,
    elevation: 3,
  },
  heavy: {
    shadowColor: "#111111",
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.14,
    shadowRadius: 48,
    elevation: 8,
  },
} as const;
