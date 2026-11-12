import { Pressable, View } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import Svg, { Circle, Defs, Line, RadialGradient, Stop, Text as SvgText } from "react-native-svg";
import { fonts, useTheme } from "@/theme";
import type { GameCardView } from "@/api/types";
import { Mono } from "./ui";

const toRad = (d: number) => (d * Math.PI) / 180;
function milesBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}
function bearing(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const y = Math.sin(toRad(b.lng - a.lng)) * Math.cos(toRad(b.lat));
  const x = Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) - Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lng - a.lng));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** Web Mercator in points at `zoom`, with 512-point tiles like Mapbox's static images. */
function project(p: { lat: number; lng: number }, zoom: number) {
  const world = 512 * 2 ** zoom;
  const s = Math.sin(toRad(p.lat));
  return { x: ((p.lng + 180) / 360) * world, y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * world };
}

type StreetMap = { url: string; zoom: number; credit: string };

/**
 * Games around the search center inside the radius ring. With `map` (a street map zoomed so the radius fills the ring)
 * each game sits at its real spot; without one, by direction and distance on a plain backdrop.
 */
export function RadiusMap({ games, center, miles, map }: { games: GameCardView[]; center: { label: string; lat: number; lng: number }; miles: number; map?: StreetMap | null }) {
  const { c } = useTheme();
  const R = 150;
  const mid = map ? project(center, map.zoom) : null;
  const pins = games
    .filter((g) => g.lat != null && g.lng != null)
    .map((g) => {
      const p = { lat: g.lat!, lng: g.lng! };
      if (map && mid) {
        const q = project(p, map.zoom);
        return { g, x: Math.min(348, Math.max(12, 180 + q.x - mid.x)), y: Math.min(348, Math.max(12, 180 + q.y - mid.y)) };
      }
      const d = Math.min(milesBetween(center, p) / miles, 1) * R;
      const a = toRad(bearing(center, p));
      return { g, x: 180 + Math.sin(a) * d, y: 180 - Math.cos(a) * d };
    });
  return (
    <View style={{ borderRadius: 28, overflow: "hidden", backgroundColor: c.night, aspectRatio: 1 }}>
      {map && (
        <>
          <Image source={map.url} style={{ position: "absolute", width: "100%", height: "100%" }} cachePolicy="disk" transition={200} />
          <View pointerEvents="none" style={{ position: "absolute", width: "100%", height: "100%", backgroundColor: c.night, opacity: 0.35 }} />
        </>
      )}
      <Svg width="100%" height="100%" viewBox="0 0 360 360">
        <Defs>
          <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#C8F25A" stopOpacity={0.16} />
            <Stop offset="100%" stopColor="#C8F25A" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={180} cy={180} r={R} fill="url(#glow)" stroke="#C8F25A" strokeOpacity={0.5} strokeDasharray="4 6" />
        {!map && (
          <>
            <Circle cx={180} cy={180} r={R / 2} fill="none" stroke="#fff" strokeOpacity={0.08} />
            <Line x1={0} y1={180} x2={360} y2={180} stroke="#fff" strokeOpacity={0.06} />
            <Line x1={180} y1={0} x2={180} y2={360} stroke="#fff" strokeOpacity={0.06} />
          </>
        )}
        <SvgText x={180} y={180 - R - 8} textAnchor="middle" fill="#fff" fillOpacity={0.5} fontSize={10} fontFamily={fonts.mono}>
          {`${miles} MI`}
        </SvgText>
        <Circle cx={180} cy={180} r={6} fill="#C8F25A" />
        {pins.map(({ g, x, y }) => (
          <Circle key={g.id} cx={x} cy={y} r={12} fill={g.my?.status === "in" ? "#C8F25A" : "#fff"} onPress={() => router.push(`/g/${g.code}`)} />
        ))}
        {pins.map(({ g, x, y }) => (
          <SvgText key={`${g.id}t`} x={x} y={y + 3.5} textAnchor="middle" fontSize={10} fontFamily={fonts.semibold} fill="#0C0D0C" onPress={() => router.push(`/g/${g.code}`)}>
            {g.time.split(":")[0]}
          </SvgText>
        ))}
      </Svg>
      <Pressable pointerEvents="none" style={{ position: "absolute", left: 16, bottom: 14 }}>
        <Mono size={10.5} color="rgba(255,255,255,0.5)">
          {center.label}
        </Mono>
      </Pressable>
      {map && (
        <Mono size={9} color="rgba(255,255,255,0.45)" style={{ position: "absolute", right: 16, bottom: 14 }} pointerEvents="none">
          {map.credit}
        </Mono>
      )}
    </View>
  );
}
