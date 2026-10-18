import { useState } from "react";
import { router } from "expo-router";
import { api } from "@/api/client";
import type { MeView } from "@/api/types";
import { useAuth } from "@/lib/auth";
import { FlowPage } from "@/components/Flow";
import { ProfileFields, type ProfileDraft } from "@/components/ProfileFields";
import { Button, Notice } from "@/components/ui";

/** First run, step 1: name, optional username and photo. */
export default function WelcomeProfile() {
  const { user, setUser } = useAuth();
  const [draft, setDraft] = useState<ProfileDraft>({ name: user?.name ?? "", username: user?.username ?? "", photo: null, removePhoto: false });
  const [usernameOk, setUsernameOk] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const me = await api<MeView>("/api/v1/me", { method: "PATCH", body: { ...draft, photo: draft.photo ?? undefined } });
      setUser({ ...me.user, onboarded: false });
      router.push("/welcome/invite");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <FlowPage
      step={0}
      steps={2}
      back={false}
      title="You're in"
      lead="Set up how you show up on rosters."
      footer={<Button title="Continue" size="lg" loading={busy} disabled={draft.name.trim().length < 2 || !usernameOk} onPress={() => void save()} />}
    >
      <ProfileFields draft={draft} onChange={setDraft} seed={user?.id ?? ""} savedPhoto={user?.photo ?? null} onUsernameOk={setUsernameOk} />
      {error ? <Notice tone="danger">{error}</Notice> : null}
    </FlowPage>
  );
}
