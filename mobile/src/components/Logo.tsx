import Svg, { Circle, G, Line, Path, Rect } from "react-native-svg";
import { View, type StyleProp, type ViewStyle } from "react-native";

/** P2: a lowercase "p" drawn as the center circle and a touchline, lime on black. */
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 132 132">
      <Rect width={132} height={132} rx={30} fill="#0C0D0C" />
      <Circle cx={62} cy={56} r={22} fill="none" stroke="#C8F25A" strokeWidth={10} />
      <Path d="M40 52v54" stroke="#C8F25A" strokeWidth={10} strokeLinecap="round" />
      <Circle cx={62} cy={56} r={6} fill="#fff" />
    </Svg>
  );
}

/** The center circle and halfway line, drawn large and faint behind night panels. */
export function PitchMotif({ size = 520, style }: { size?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View pointerEvents="none" style={[{ position: "absolute", width: size, height: size, opacity: 0.07 }, style]}>
      <Svg width={size} height={size} viewBox="0 0 400 400">
        <G fill="none" stroke="#FFFFFF" strokeWidth={2}>
          <Circle cx={200} cy={200} r={120} />
          <Line x1={0} y1={200} x2={400} y2={200} />
          <Circle cx={200} cy={200} r={4} fill="#FFFFFF" />
        </G>
      </Svg>
    </View>
  );
}
