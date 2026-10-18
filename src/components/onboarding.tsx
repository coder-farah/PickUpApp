"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Camera, Check, Contact, Loader2, Plus, Search, X } from "lucide-react";
import { buttonClass } from "./ui";
import { Avatar } from "./Avatar";
import { cn } from "@/lib/cn";

/** "4155550123" → "(415) 555-0123", formatting as you type. */
function formatUs(digits: string) {
  const d = digits.slice(0, 10);
  if (d.length < 4) return d;
  if (d.length < 7) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

function digitsOf(v: string) {
  let d = v.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
  return d.slice(0, 10);
}

function Submit({ children, disabled, className, pending: pendingLabel }: { children: React.ReactNode; disabled?: boolean; className?: string; pending?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={disabled || pending} className={buttonClass("primary", "lg", cn("w-full", className))}>
      {pending ? (
        <>
          <Loader2 className="size-4 animate-spin" /> {pendingLabel ?? children}
        </>
      ) : (
        children
      )}
    </button>
  );
}

export function PhoneField() {
  const [digits, setDigits] = useState("");
  return (
    <div className="flex flex-col gap-4">
      <label htmlFor="phone" className="sr-only">
        Mobile number
      </label>
      <div className="flex h-16 items-center gap-3 rounded-2xl border border-line bg-surface px-4 focus-within:border-ink">
        <span className="flex shrink-0 items-center gap-1.5 text-[17px]">
          <span aria-hidden>🇺🇸</span> +1
        </span>
        <span className="h-6 w-px bg-line" />
        <input
          id="phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          autoFocus
          required
          placeholder="(415) 555-0123"
          value={formatUs(digits)}
          onChange={(e) => setDigits(digitsOf(e.target.value))}
          className="nums h-full min-w-0 flex-1 bg-transparent text-[20px] tracking-wide outline-none placeholder:text-muted/60"
        />
      </div>
      <Submit disabled={digits.length !== 10} pending="Sending code">
        Send code
      </Submit>
    </div>
  );
}

/** Six boxes over one input, so iOS and Android can fill the code from Messages. Submits on the sixth digit. */
export function CodeField() {
  const [code, setCode] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  const { pending } = useFormStatus();
  useEffect(() => {
    if (code.length === 6) ref.current?.form?.requestSubmit();
  }, [code]);
  return (
    <div className="flex flex-col gap-4">
      <label htmlFor="code" className="sr-only">
        6-digit code
      </label>
      <div className="relative" onClick={() => ref.current?.focus()}>
        <input
          ref={ref}
          id="code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          autoFocus
          required
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          className="absolute inset-0 z-10 h-full w-full opacity-0"
        />
        <div className="grid grid-cols-6 gap-2" aria-hidden>
          {Array.from({ length: 6 }, (_, i) => (
            <span
              key={i}
              className={cn(
                "disp nums grid h-16 place-items-center rounded-2xl bg-surface text-[34px] shadow-card",
                i === code.length && "ring-2 ring-ink",
                code[i] && "bg-night text-lime",
              )}
            >
              {code[i] ?? ""}
            </span>
          ))}
        </div>
      </div>
      {pending && (
        <p className="flex items-center justify-center gap-2 text-[14px] text-muted">
          <Loader2 className="size-4 animate-spin" /> Checking
        </p>
      )}
    </div>
  );
}

export function ResendButton({ seconds = 30 }: { seconds?: number }) {
  const [left, setLeft] = useState(seconds);
  const { pending } = useFormStatus();
  useEffect(() => {
    if (left <= 0) return;
    const id = setTimeout(() => setLeft((l) => l - 1), 1000);
    return () => clearTimeout(id);
  }, [left]);
  return (
    <button
      type="submit"
      disabled={left > 0 || pending}
      onClick={() => setTimeout(() => setLeft(seconds), 0)}
      className="text-[14px] font-medium text-ink disabled:text-muted"
    >
      {left > 0 ? `Resend code in 0:${String(left).padStart(2, "0")}` : pending ? "Sending" : "Resend code"}
    </button>
  );
}

/** Crop to a centered square and shrink to 256px JPEG before upload. */
async function shrink(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  canvas.getContext("2d")!.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, 256, 256);
  return canvas.toDataURL("image/jpeg", 0.85);
}

type Check = { ok: boolean; username: string; message: string; suggestion?: string };

export function ProfileFields({
  userId,
  name: initialName,
  username: initialUsername,
  photo,
  submitLabel,
}: {
  userId: string;
  name: string;
  username: string;
  photo: number;
  submitLabel: string;
}) {
  const [name, setName] = useState(initialName);
  const [username, setUsername] = useState(initialUsername);
  const [preview, setPreview] = useState<string | null>(null);
  const [data, setData] = useState("");
  const [removed, setRemoved] = useState(false);
  const [check, setCheck] = useState<Check | null>(null);
  const [checking, setChecking] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    clearTimeout(timer.current);
    const u = username.trim().replace(/^@/, "");
    if (!u || u === initialUsername) {
      setCheck(null);
      return;
    }
    setChecking(true);
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/username?u=${encodeURIComponent(u)}`);
        setCheck((await res.json()) as Check);
      } catch {
        setCheck(null);
      } finally {
        setChecking(false);
      }
    }, 300);
  }, [username, initialUsername]);

  const hasPhoto = !removed && (!!preview || photo > 0);
  const blocked = name.trim().length < 2 || checking || (!!username.trim() && username.trim() !== initialUsername && !check?.ok);

  return (
    <div className="flex flex-col gap-6">
      <input type="hidden" name="photo" value={data} />
      <input type="hidden" name="removePhoto" value={removed ? "1" : ""} />
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          try {
            const url = await shrink(file);
            setPreview(url);
            setData(url);
            setRemoved(false);
          } catch {
            setPreview(null);
          }
        }}
      />
      <div className="flex flex-col items-center gap-3">
        <button type="button" onClick={() => fileRef.current?.click()} className="relative rounded-full" aria-label={hasPhoto ? "Change photo" : "Add a photo"}>
          <span className={cn("block rounded-full p-1", hasPhoto ? "bg-lime" : "bg-transparent")}>
            {preview && !removed ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="" className="size-[104px] rounded-full object-cover" />
            ) : (
              <Avatar name={name || "?"} seed={userId} photo={removed ? 0 : photo} size={104} />
            )}
          </span>
          <span className="absolute right-1 bottom-1 grid size-9 place-items-center rounded-full bg-night text-lime ring-4 ring-bg">
            <Camera className="size-4" />
          </span>
        </button>
        {hasPhoto ? (
          <button type="button" onClick={() => { setRemoved(true); setPreview(null); setData(""); }} className="text-[13px] text-muted">
            Remove photo
          </button>
        ) : (
          <span className="text-[13px] text-muted">Add a photo (optional)</span>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="name" className="eyebrow">
          Name
        </label>
        <input
          id="name"
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={40}
          placeholder="Pooya F."
          autoComplete="name"
          className="h-14 rounded-2xl border border-line bg-surface px-4 text-[17px] focus:border-ink focus:outline-none"
        />
        <p className="text-[13px] text-muted">How you show up on rosters. First name and last initial works well.</p>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="username" className="eyebrow">
          Username <span className="normal-case">(optional)</span>
        </label>
        <div className="flex h-14 items-center rounded-2xl border border-line bg-surface px-4 focus-within:border-ink">
          <span className="text-[17px] text-muted">@</span>
          <input
            id="username"
            name="username"
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ""))}
            maxLength={21}
            placeholder="pooya"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="h-full min-w-0 flex-1 bg-transparent pl-0.5 text-[17px] outline-none"
          />
          {checking ? <Loader2 className="size-4 animate-spin text-muted" /> : check?.ok ? <Check className="size-5 rounded-full bg-lime p-0.5 text-lime-ink" strokeWidth={3} /> : null}
        </div>
        {check && (
          <p className={cn("text-[13px]", check.ok ? "text-pitch" : "text-danger")}>
            {check.message}
            {check.suggestion && (
              <>
                {" "}
                Try{" "}
                <button type="button" className="font-semibold underline underline-offset-2" onClick={() => setUsername(check.suggestion!)}>
                  @{check.suggestion}
                </button>
              </>
            )}
          </p>
        )}
        {!check && <p className="text-[13px] text-muted">Friends can find and invite you by it.</p>}
      </div>

      <Submit disabled={blocked} pending="Saving">
        {submitLabel}
      </Submit>
    </div>
  );
}

type Person = { name?: string; phone: string };
type GameOption = { id: string; title: string; when: string; place: string };

type ContactsManager = { select: (props: string[], opts: { multiple: boolean }) => Promise<{ name?: string[]; tel?: string[] }[]> };

export function InviteFields({ inviter, games }: { inviter: string; games: GameOption[] }) {
  const [people, setPeople] = useState<Person[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [withGame, setWithGame] = useState(false);
  const [gameId, setGameId] = useState(games[0]?.id ?? "");
  const [canPick, setCanPick] = useState(false);
  useEffect(() => setCanPick(typeof navigator !== "undefined" && "contacts" in navigator), []);

  const digits = digitsOf(phone);
  const add = () => {
    if (digits.length !== 10 || people.some((p) => digitsOf(p.phone) === digits)) return;
    setPeople((ps) => [...ps, { name: name.trim() || undefined, phone: digits }]);
    setName("");
    setPhone("");
  };
  const pick = async () => {
    try {
      const picked = await (navigator as unknown as { contacts: ContactsManager }).contacts.select(["name", "tel"], { multiple: true });
      const add = picked
        .map((c) => ({ name: c.name?.[0], phone: digitsOf(c.tel?.[0] ?? "") }))
        .filter((c) => c.phone.length === 10);
      setPeople((ps) => [...ps, ...add.filter((a) => !ps.some((p) => digitsOf(p.phone) === a.phone))]);
    } catch {}
  };
  const game = games.find((g) => g.id === gameId);
  const firstName = people[0]?.name?.split(" ")[0];

  return (
    <div className="flex flex-col gap-5">
      <input type="hidden" name="people" value={JSON.stringify(people)} />
      <input type="hidden" name="gameId" value={withGame ? gameId : ""} />

      {canPick && (
        <button type="button" onClick={pick} className="flex items-center gap-3 rounded-2xl bg-night px-4 py-3.5 text-left text-white">
          <Contact className="size-5 text-lime" />
          <span className="text-[15px] font-medium">Choose from contacts</span>
        </button>
      )}

      <div className="flex flex-col gap-2 rounded-2xl bg-surface p-3 shadow-card">
        <div className="flex items-center gap-2 px-1">
          <Search className="size-4 text-muted" />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name (optional)"
            className="h-10 min-w-0 flex-1 bg-transparent text-[15px] outline-none"
            aria-label="Friend's name"
          />
        </div>
        <div className="flex items-center gap-2">
          <input
            value={formatUs(digits)}
            onChange={(e) => setPhone(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            type="tel"
            inputMode="tel"
            placeholder="(415) 555-0123"
            aria-label="Friend's mobile number"
            className="nums h-11 min-w-0 flex-1 rounded-xl bg-surface-2 px-3 text-[16px] outline-none"
          />
          <button type="button" onClick={add} disabled={digits.length !== 10} className={buttonClass("primary", "md", "shrink-0 px-4")}>
            <Plus className="size-4" /> Invite
          </button>
        </div>
      </div>

      {people.length > 0 && (
        <ul className="flex flex-col">
          {people.map((p, i) => (
            <li key={p.phone} className="flex items-center gap-3 border-b border-line py-2.5">
              <Avatar name={p.name ?? "?"} seed={p.phone} size={36} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-medium">{p.name ?? formatUs(p.phone)}</span>
                {p.name && <span className="nums block text-[13px] text-muted">{formatUs(p.phone)}</span>}
              </span>
              <span className="mono inline-flex h-7 items-center rounded-full bg-lime px-3 text-[10.5px] text-lime-ink">Invited</span>
              <button type="button" aria-label={`Remove ${p.name ?? p.phone}`} onClick={() => setPeople((ps) => ps.filter((_, j) => j !== i))} className="grid size-8 place-items-center rounded-full text-muted hover:bg-surface-2">
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {games.length > 0 && (
        <div className="flex flex-col gap-3 rounded-2xl bg-surface p-4 shadow-card">
          <label className="flex cursor-pointer items-center justify-between gap-4">
            <span>
              <span className="block text-[15px] font-medium">Invite them to a game too</span>
              <span className="block text-[13px] text-muted">A public game near you this week.</span>
            </span>
            <span className="relative inline-flex shrink-0">
              <input type="checkbox" name="withGame" checked={withGame} onChange={(e) => setWithGame(e.target.checked)} className="peer sr-only" />
              <span className="h-7 w-12 rounded-full bg-surface-2 transition-colors peer-checked:bg-night" />
              <span className="absolute top-1 left-1 size-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5 peer-checked:bg-lime" />
            </span>
          </label>
          {withGame && (
            <div className="flex flex-col gap-2">
              {games.map((g) => (
                <label key={g.id} className={cn("flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5", gameId === g.id ? "bg-night text-white" : "bg-surface-2")}>
                  <input type="radio" name="gamePick" value={g.id} checked={gameId === g.id} onChange={() => setGameId(g.id)} className="sr-only" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14.5px] font-medium">{g.title}</span>
                    <span className={cn("block truncate text-[12.5px]", gameId === g.id ? "text-white/60" : "text-muted")}>
                      {g.when} · {g.place}
                    </span>
                  </span>
                  {gameId === g.id && <Check className="size-4 text-lime" strokeWidth={3} />}
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      {people.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="eyebrow">What {firstName ?? "they"} will get</p>
          <p className="max-w-[85%] self-start rounded-[20px] rounded-bl-md bg-surface-2 px-4 py-3 text-[14.5px] leading-snug">
            {inviter} invited you to Pitchin{withGame && game ? `, and to ${game.title} on ${game.when}` : ", the easy way to find pickup games"}. Join here: pitchin.app/i/…
          </p>
        </div>
      )}

      <Submit disabled={people.length === 0} pending="Sending">
        {people.length ? `Text ${people.length} invite${people.length === 1 ? "" : "s"}` : "Add someone to invite"}
      </Submit>
    </div>
  );
}
