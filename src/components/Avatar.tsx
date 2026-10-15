import { cn } from "@/lib/cn";

function hue(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
  return h;
}

export function initials(name: string | null | undefined) {
  const parts = (name ?? "?").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return ((parts[0][0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export function Avatar({
  name,
  seed,
  size = 36,
  className,
  ring,
}: {
  name: string | null | undefined;
  seed?: string;
  size?: number;
  className?: string;
  ring?: boolean;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "avatar inline-grid shrink-0 place-items-center rounded-[34%] font-semibold select-none",
        ring && "ring-2 ring-surface",
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36), ["--h" as string]: hue(seed ?? name ?? "") }}
    >
      {initials(name)}
    </span>
  );
}

export function AvatarStack({ people, max = 5, size = 26 }: { people: { id: string; name: string | null }[]; max?: number; size?: number }) {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  return (
    <div className="flex items-center">
      {shown.map((p, i) => (
        <Avatar key={p.id + i} name={p.name} seed={p.id} size={size} ring className={i ? "-ml-2" : ""} />
      ))}
      {extra > 0 && (
        <span className="-ml-2 inline-grid place-items-center rounded-[34%] bg-surface-2 font-mono text-[10px] text-muted ring-2 ring-surface" style={{ width: size, height: size }}>
          +{extra}
        </span>
      )}
    </div>
  );
}
