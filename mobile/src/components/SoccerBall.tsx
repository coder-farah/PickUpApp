import { useId } from "react";
import Svg, { Circle, ClipPath, Defs, G, Line, Polygon } from "react-native-svg";

/** Points of a pentagon centred on (x, y), with one corner pointing at `angle` degrees (0 is straight up). */
function pentagon(x: number, y: number, r: number, angle: number) {
  return Array.from({ length: 5 }, (_, i) => {
    const a = ((angle + i * 72 - 90) * Math.PI) / 180;
    return `${(x + r * Math.cos(a)).toFixed(2)},${(y + r * Math.sin(a)).toFixed(2)}`;
  }).join(" ");
}

const at = (deg: number, d: number) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return { x: 50 + d * Math.cos(a), y: 50 + d * Math.sin(a) };
};

/** A classic black-and-white ball, drawn rather than an image so it stays crisp at any size. */
export function SoccerBall({ size = 28, patch = "#0B1F14", shell = "#FFFFFF" }: { size?: number; patch?: string; shell?: string }) {
  const clip = `ball-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <ClipPath id={clip}>
          <Circle cx={50} cy={50} r={47} />
        </ClipPath>
      </Defs>
      <Circle cx={50} cy={50} r={47} fill={shell} />
      <G clipPath={`url(#${clip})`} fill={patch} stroke={patch} strokeWidth={3} strokeLinejoin="round">
        <Polygon points={pentagon(50, 50, 16, 0)} />
        {[0, 72, 144, 216, 288].map((deg) => {
          const seamFrom = at(deg, 16);
          const seamTo = at(deg, 32);
          const outer = at(deg + 36, 46);
          return (
            <G key={deg}>
              <Line x1={seamFrom.x} y1={seamFrom.y} x2={seamTo.x} y2={seamTo.y} />
              <Line x1={seamTo.x} y1={seamTo.y} x2={at(deg + 36, 30).x} y2={at(deg + 36, 30).y} />
              <Line x1={seamTo.x} y1={seamTo.y} x2={at(deg - 36, 30).x} y2={at(deg - 36, 30).y} />
              <Polygon points={pentagon(outer.x, outer.y, 15, deg + 36 + 180)} />
            </G>
          );
        })}
      </G>
      {/* A white rim keeps the outline round on dark backgrounds, where edge patches would blend in. */}
      <Circle cx={50} cy={50} r={45.5} fill="none" stroke={shell} strokeWidth={5} />
    </Svg>
  );
}
