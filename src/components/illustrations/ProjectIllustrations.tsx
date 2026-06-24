import Svg, { Circle, Defs, G, Line, Path, Rect, Stop, LinearGradient } from "react-native-svg";
import { colors } from "@/lib/theme/tokens";

type IllustrationProps = {
  height?: number;
  width?: number;
};

export function GroupProjectIllustration({ height = 112, width = 154 }: IllustrationProps) {
  return (
    <Svg height={height} viewBox="0 0 154 112" width={width}>
      <Defs>
        <LinearGradient id="groupProjectBg" x1="0" x2="1" y1="0" y2="1">
          <Stop offset="0" stopColor="#fff8d7" />
          <Stop offset="1" stopColor="#eef4ff" />
        </LinearGradient>
      </Defs>
      <Rect fill="url(#groupProjectBg)" height="102" rx="24" width="146" x="4" y="5" />
      <Circle cx="47" cy="38" fill={colors.primary} r="17" />
      <Circle cx="47" cy="34" fill="#111111" r="5" />
      <Path d="M35 52c4-8 20-8 24 0v5H35z" fill="#111111" opacity="0.88" />
      <Circle cx="104" cy="34" fill="#2563eb" r="15" />
      <Circle cx="104" cy="30" fill="#ffffff" r="4.6" />
      <Path d="M94 47c3.6-7 16.4-7 20 0v4H94z" fill="#ffffff" opacity="0.95" />
      <Circle cx="74" cy="72" fill="#ffffff" r="21" />
      <Circle cx="74" cy="67" fill="#171511" r="6" />
      <Path d="M59 87c5-9 25-9 30 0v5H59z" fill="#171511" opacity="0.9" />
      <Rect fill="#ffffff" height="36" rx="10" width="52" x="73" y="45" />
      <Rect fill={colors.primary} height="6" rx="3" width="25" x="84" y="55" />
      <Rect fill="#d8dde8" height="5" rx="2.5" width="31" x="84" y="67" />
      <Circle cx="78" cy="57" fill="#2563eb" r="3" />
      <Circle cx="78" cy="69" fill="#059669" r="3" />
      <Line stroke="#171511" strokeLinecap="round" strokeOpacity="0.18" strokeWidth="2" x1="49" x2="71" y1="50" y2="62" />
      <Line stroke="#171511" strokeLinecap="round" strokeOpacity="0.18" strokeWidth="2" x1="101" x2="89" y1="50" y2="61" />
    </Svg>
  );
}

export function ScrumBoardIllustration({ height = 112, width = 154 }: IllustrationProps) {
  return (
    <Svg height={height} viewBox="0 0 154 112" width={width}>
      <Defs>
        <LinearGradient id="scrumBoardBg" x1="0" x2="1" y1="0" y2="1">
          <Stop offset="0" stopColor="#f8f7fb" />
          <Stop offset="1" stopColor="#eef4ff" />
        </LinearGradient>
      </Defs>
      <Rect fill="url(#scrumBoardBg)" height="102" rx="24" width="146" x="4" y="5" />
      <Rect fill="#ffffff" height="70" rx="12" width="116" x="19" y="22" />
      <Line stroke="#d8dde8" strokeWidth="2" x1="19" x2="135" y1="39" y2="39" />
      <Line stroke="#d8dde8" strokeWidth="2" x1="58" x2="58" y1="22" y2="92" />
      <Line stroke="#d8dde8" strokeWidth="2" x1="96" x2="96" y1="22" y2="92" />
      <Rect fill="#171511" height="5" rx="2.5" width="22" x="30" y="31" />
      <Rect fill="#171511" height="5" rx="2.5" width="21" x="67" y="31" />
      <Rect fill="#171511" height="5" rx="2.5" width="22" x="105" y="31" />
      <G>
        <Rect fill={colors.primary} height="18" rx="5" width="27" x="26" y="49" />
        <Rect fill="#e7bc00" height="4" rx="2" width="14" x="32" y="56" />
      </G>
      <G>
        <Rect fill="#2563eb" height="18" rx="5" width="27" x="64" y="57" />
        <Rect fill="#ffffff" height="4" rx="2" width="14" x="70" y="64" opacity="0.9" />
      </G>
      <G>
        <Rect fill="#059669" height="18" rx="5" width="27" x="102" y="47" />
        <Rect fill="#ffffff" height="4" rx="2" width="14" x="108" y="54" opacity="0.9" />
      </G>
      <Path d="M39 78h76" stroke="#171511" strokeLinecap="round" strokeOpacity="0.12" strokeWidth="3" />
      <Circle cx="121" cy="83" fill={colors.primary} r="10" />
      <Path d="M116 83h10M121 78v10" stroke="#111111" strokeLinecap="round" strokeWidth="2.2" />
    </Svg>
  );
}
