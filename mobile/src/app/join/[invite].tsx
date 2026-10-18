import { useEffect, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { keys } from "@/api/hooks";
import type { CrewView } from "@/api/types";
import { ErrorView, Loading } from "@/components/ui";

/** An invite link to an invite-only crew: join, then open the crew. */
export default function JoinByInvite() {
  const { invite } = useLocalSearchParams<{ invite: string }>();
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
