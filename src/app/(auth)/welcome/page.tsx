import { requireUser, safeNext } from "@/server/auth";
import { saveNameAction } from "@/app/actions";
import { ActionForm, SubmitButton } from "@/components/client";
import { Card, Input } from "@/components/ui";

export default async function WelcomePage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const user = await requireUser("/welcome");
  return (
    <Card className="rise flex flex-col gap-6 p-6 sm:p-8">
      <div className="flex flex-col gap-2">
        <span className="eyebrow">One last thing</span>
        <h1 className="font-display text-[40px] uppercase">What do people call you?</h1>
        <p className="text-[15px] text-muted">This is how you show up on rosters. First name and last initial works well.</p>
      </div>
      <ActionForm action={saveNameAction} hidden={{ next: safeNext(next) }} className="gap-3">
        <label htmlFor="name" className="sr-only">
          Your name
        </label>
        <Input id="name" name="name" defaultValue={user.name ?? ""} placeholder="Pooya F." required autoFocus maxLength={40} className="h-14 rounded-2xl text-lg" />
        <SubmitButton size="lg">Let&apos;s play</SubmitButton>
      </ActionForm>
    </Card>
  );
}
