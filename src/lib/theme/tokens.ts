export const colors = {
  background: "#ffffff",
  foreground: "#111111",
  panel: "#ffffff",
  panelMuted: "#f5f2e6",
  line: "#e8e0c8",
  primary: "#ffd400",
  primaryDark: "#e7bc00",
  accent: "#0256ff",
  inkSoft: "#68645b",
  danger: "#b91c1c",
  warning: "#b45309",
  success: "#047857",
  black: "#111111",
  white: "#ffffff",
  slate: "#344054",
  muted: "#f8f7f2",
  blueSoft: "#eef4ff",
  greenSoft: "#ecfdf3",
  redSoft: "#fef2f2",
  yellowSoft: "#fff7d6",
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
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
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
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.08,
    shadowRadius: 34,
    elevation: 4,
  },
  heavy: {
    shadowColor: "#111111",
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.16,
    shadowRadius: 48,
    elevation: 8,
  },
} as const;
