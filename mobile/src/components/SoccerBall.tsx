import { useId } from "react";
import Svg, { Circle, ClipPath, Defs, G, Line, Polygon, RadialGradient, Stop } from "react-native-svg";

type Pt = { x: number; y: number };

/** A point `d` from the centre at `deg` degrees, clockwise from straight up (the art is on a 100×100 box). */
const polar = (deg: number, d: number, from: Pt = { x: 50, y: 50 }): Pt => {
  const a = ((deg - 90) * Math.PI) / 180;
  return { x: from.x + d * Math.cos(a), y: from.y + d * Math.sin(a) };
};
/** Corners of a pentagon, the first pointing at `deg`, going clockwise. */
const pentagon = (c: Pt, r: number, deg: number) => Array.from({ length: 5 }, (_, i) => polar(deg + i * 72, r, c));
const pts = (p: Pt[]) => p.map((q) => `${q.x.toFixed(2)},${q.y.toFixed(2)}`).join(" ");

// The classic truncated-icosahedron view: a pentagon facing you, five hexagons round it, and five more pentagons
// toward the rim. Each seam between two hexagons runs from a corner of the middle pentagon to the facing corner of an
// outer one; the outer pentagons' side corners join up to close the hexagons.
const CENTER = pentagon({ x: 50, y: 50 }, 15, 0);
const OUTER = [0, 72, 144, 216, 288].map((deg) => pentagon(polar(deg, 40), 13.5, deg + 180));
const SEAMS: [Pt, Pt][] = OUTER.flatMap((p, k) => [
  [CENTER[k], p[0]] as [Pt, Pt],
  [p[4], OUTER[(k + 1) % 5][1]] as [Pt, Pt],
  // The far hexagons, only their inner edges show before the rim.
  [p[2], polar(k * 72 + 36, 52)] as [Pt, Pt],
]);

/** A black-and-white soccer ball, drawn so it stays crisp at any size. */
export function SoccerBall({ size = 28, patch = "#111814" }: { size?: number; patch?: string }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <ClipPath id={`clip${id}`}>
          <Circle cx={50} cy={50} r={47} />
        </ClipPath>
        <RadialGradient id={`shade${id}`} cx="38%" cy="32%" r="75%">
          <Stop offset="0" stopColor="#FFFFFF" />
          <Stop offset="0.65" stopColor="#F1F2EE" />
          <Stop offset="1" stopColor="#C9CCC4" />
        </RadialGradient>
      </Defs>
      <Circle cx={50} cy={50} r={47} fill={`url(#shade${id})`} />
      <G clipPath={`url(#clip${id})`} stroke={patch} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round">
        {SEAMS.map(([a, b], i) => (
          <Line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
        ))}
        <Polygon points={pts(CENTER)} fill={patch} />
        {OUTER.map((p, i) => (
          <Polygon key={i} points={pts(p)} fill={patch} />
        ))}
      </G>
      <Circle cx={50} cy={50} r={46.5} fill="none" stroke={patch} strokeOpacity={0.5} strokeWidth={1.5} />
    </Svg>
  );
}
