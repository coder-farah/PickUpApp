import { View } from "react-native";
import { router } from "expo-router";
import { useTheme } from "@/theme";
import type { CrewCardView } from "@/api/types";
import { initials } from "./Avatar";
import { Users } from "./icons";
import { Body, Card, Disp, Mono } from "./ui";

export function CrewCrest({ name, size = 48 }: { name: string; size?: number }) {
  const { c } = useTheme();
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.3, backgroundColor: c.night, alignItems: "center", justifyContent: "center" }}>
      <Disp size={size * 0.42} color={c.lime}>
        {initials(name)}
      </Disp>
    </View>
  );
}

/** A crew in the Home carousel. */
export function CrewTile({ crew }: { crew: CrewCardView }) {
  const { c } = useTheme();
  return (
    <Card onPress={() => router.push(`/groups/${crew.slug}`)} style={{ width: 150, gap: 12 }}>
      <CrewCrest name={crew.name} />
      <View>
        <Body weight="semibold" size={14.5} numberOfLines={1}>
          {crew.name}
        </Body>
        <Body size={12.5} color={c.muted} numberOfLines={1}>
          {crew.role === "organizer" ? "You organize" : crew.schedule || "Weekly games"}
          {crew.area ? ` · ${crew.area}` : ""}
        </Body>
      </View>
    </Card>
  );
}

/** A crew in Explore: crest, weekly times, members and distance. */
export function CrewRow({ crew }: { crew: CrewCardView }) {
  const { c } = useTheme();
  return (
    <Card onPress={() => router.push(`/groups/${crew.slug}`)} style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
      <CrewCrest name={crew.name} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Body weight="semibold" numberOfLines={1}>
          {crew.name}
        </Body>
        <Body size={13} color={c.muted} numberOfLines={1}>
          {crew.schedule || "Weekly games"}
        </Body>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
          <Users size={12} color={c.muted} />
          <Mono size={10.5}>
            {crew.members}
            {crew.distance ? ` · ${crew.distance}` : ""}
          </Mono>
        </View>
      </View>
    </Card>
  );
}
