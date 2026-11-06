import { useEffect, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { keys } from "@/api/hooks";
import type { CrewView } from "@/api/types";
import { ErrorView, Loading } from "@/components/ui";
import { SignInPrompt } from "@/components/SignInPrompt";
import { useAuth } from "@/lib/auth";
import { askToSignIn } from "@/lib/intent";

/** An invite link to an invite-only crew: join, then open the crew. */
export default function JoinByInvite() {
  const { invite } = useLocalSearchParams<{ invite: string }>();
  const signedIn = useAuth().status === "signedIn";
  // A guest signs in first, then lands back here and joins.
  useEffect(() => {
    if (!signedIn) askToSignIn({ path: `/join/${invite}` });
  }, [signedIn, invite]);
  if (!signedIn)
    return (
      <SignInPrompt eyebrow="Invite" title="You're invited to a crew">
        Sign in to join. You&apos;ll see the crew&apos;s games and get a heads-up when each week&apos;s game opens.
      </SignInPrompt>
    );
  return <Joining invite={invite} />;
}

function Joining({ invite }: { invite: string }) {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api<CrewView>("/api/v1/crews/-/join", { body: { invite } })
      .then((crew) => {
        qc.setQueryData(keys.crew(crew.crew.slug), crew);
        void qc.invalidateQueries({ queryKey: keys.home });
        router.replace(`/groups/${crew.crew.slug}`);
      })
      .catch((e: Error) => setError(e.message));
  }, [invite, qc]);
  return error ? <ErrorView message={error} onRetry={() => router.replace("/")} /> : <Loading />;
}
