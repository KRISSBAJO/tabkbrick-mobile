import { Text, TextInput, type TextStyle } from "react-native";
import { fonts } from "@/lib/theme/tokens";

type ComponentWithDefaultProps = {
  defaultProps?: {
    style?: unknown;
  };
};

let installed = false;

export function installGlobalFontDefaults() {
  if (installed) return;
  installed = true;

  installDefaultStyle(Text, { fontFamily: fonts.regular });
  installDefaultStyle(TextInput, { fontFamily: fonts.regular });
}

function installDefaultStyle(Component: unknown, defaultStyle: { fontFamily: string }) {
  const componentWithDefaults = Component as ComponentWithDefaultProps;
  const existingStyle = componentWithDefaults.defaultProps?.style;

  componentWithDefaults.defaultProps = {
    ...componentWithDefaults.defaultProps,
    style: existingStyle ? [defaultStyle, existingStyle] : defaultStyle,
  };
}

export function fontFamilyForWeight(weight: TextStyle["fontWeight"] = "400") {
  if (weight === "bold") return fonts.bold;
  if (typeof weight === "number") return fontFamilyForNumericWeight(weight);

  const numeric = Number.parseInt(String(weight), 10);
  return Number.isFinite(numeric) ? fontFamilyForNumericWeight(numeric) : fonts.regular;
}

export function withFontStyles<T extends Record<string, unknown>>(styles: T): T {
  return Object.fromEntries(
    Object.entries(styles).map(([key, style]) => {
      if (!style || typeof style !== "object" || Array.isArray(style)) {
        return [key, style];
      }

      const textStyle = style as TextStyle;
      if (!looksLikeTextStyle(textStyle) || textStyle.fontFamily) {
        return [key, style];
      }

      return [key, { fontFamily: fontFamilyForWeight(textStyle.fontWeight), ...textStyle }];
    }),
  ) as T;
}

function fontFamilyForNumericWeight(weight: number) {
  if (weight >= 800) return fonts.extraBold;
  if (weight >= 700) return fonts.bold;
  if (weight >= 600) return fonts.semiBold;
  if (weight >= 500) return fonts.medium;
  return fonts.regular;
}

function looksLikeTextStyle(style: TextStyle) {
  return (
    style.fontSize !== undefined ||
    style.fontWeight !== undefined ||
    style.lineHeight !== undefined ||
    style.letterSpacing !== undefined ||
    style.textAlign !== undefined ||
    style.textTransform !== undefined
  );
}
