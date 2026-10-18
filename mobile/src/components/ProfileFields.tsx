import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { api } from "@/api/client";
import type { UsernameCheckView } from "@/api/types";
import { pickProfilePhoto } from "@/lib/photo";
import { useTheme } from "@/theme";
import { Avatar } from "./Avatar";
import { ImagePlus } from "./icons";
import { Body, Field, Input, Mono } from "./ui";

export type ProfileDraft = { name: string; username: string; photo: string | null; removePhoto: boolean };

/** Photo, name and an optional @username checked as you type, with a free suggestion when taken. */
export function ProfileFields({ draft, onChange, seed, savedPhoto, onUsernameOk }: { draft: ProfileDraft; onChange: (d: ProfileDraft) => void; seed: string; savedPhoto: string | null; onUsernameOk: (ok: boolean) => void }) {
  const { c } = useTheme();
  const [check, setCheck] = useState<UsernameCheckView | null>(null);
  const shownPhoto = draft.photo ?? (draft.removePhoto ? null : savedPhoto);

  useEffect(() => {
    const u = draft.username.trim();
    if (!u) {
      setCheck(null);
      onUsernameOk(true);
      return;
    }
    const t = setTimeout(() => {
      api<UsernameCheckView>(`/api/username?u=${encodeURIComponent(u)}`)
        .then((r) => {
          setCheck(r);
          onUsernameOk(r.ok);
        })
        .catch(() => onUsernameOk(true));
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.username]);

  return (
    <View style={{ gap: 22 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
        <Pressable
          accessibilityLabel="Choose a photo"
          onPress={async () => {
            const photo = await pickProfilePhoto();
            if (photo) onChange({ ...draft, photo, removePhoto: false });
          }}
        >
          <Avatar name={draft.name || "?"} seed={seed} photo={shownPhoto} size={84} />
          <View style={{ position: "absolute", right: -2, bottom: -2, width: 30, height: 30, borderRadius: 15, backgroundColor: c.btn, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: c.bg }}>
            <ImagePlus size={15} color={c.btnInk} />
          </View>
        </Pressable>
        <View style={{ flex: 1, gap: 4 }}>
          <Body weight="semibold">Profile photo</Body>
          <Body size={13} color={c.muted}>
            Optional. Helps the crew spot you at the field.
          </Body>
          {shownPhoto ? (
            <Body size={13} color={c.danger} onPress={() => onChange({ ...draft, photo: null, removePhoto: true })}>
              Remove
            </Body>
          ) : null}
        </View>
      </View>
      <Field label="Your name" hint="What teammates call you. Shown on rosters.">
        <Input value={draft.name} onChangeText={(name) => onChange({ ...draft, name })} placeholder="Sam R." textContentType="name" autoComplete="name" maxLength={40} />
      </Field>
      <Field label="Username (optional)" error={check && !check.ok ? check.message : null} hint={check?.ok ? check.message : "So friends can find you."}>
        <View>
          <Input
            value={draft.username}
            onChangeText={(username) => onChange({ ...draft, username: username.replace(/^@/, "").toLowerCase() })}
            placeholder="samr"
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={30}
            style={{ paddingLeft: 30 }}
          />
          <Mono size={16} color={c.muted} style={{ position: "absolute", left: 14, top: 15 }}>
            @
          </Mono>
        </View>
      </Field>
      {check?.suggestion ? (
        <Pressable onPress={() => onChange({ ...draft, username: check.suggestion! })} style={{ alignSelf: "flex-start", marginTop: -12 }}>
          <Mono size={12} color={c.pitch}>
            Use @{check.suggestion}
          </Mono>
        </Pressable>
      ) : null}
    </View>
  );
}
