import { cn } from "@/lib/cn";

/** A person on a roster: id for the color and photo, `v` is their photo version (0 = no photo). */
export type Face = { id: string; name: string | null; v?: number | null };

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

export const photoUrl = (id: string, v?: number | null) => (v ? `/api/avatar/${id}?v=${v}` : null);

export function Avatar({
  name,
  seed,
  photo,
  size = 36,
  className,
  ring,
  square,
}: {
  name: string | null | undefined;
  seed?: string;
  /** Photo version; when set, the photo is shown instead of initials. */
  photo?: number | null;
  size?: number;
  className?: string;
  ring?: boolean;
  square?: boolean;
}) {
  const src = seed ? photoUrl(seed, photo) : null;
  const shape = square ? "rounded-[30%]" : "rounded-full";
  if (src)
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        className={cn("shrink-0 object-cover", shape, ring && "ring-2 ring-[var(--ring,var(--bg))]", className)}
        style={{ width: size, height: size }}
      />
    );
  return (
    <span
      aria-hidden
      className={cn(
        "avatar inline-grid shrink-0 place-items-center font-semibold select-none",
        shape,
        ring && "ring-2 ring-[var(--ring,var(--bg))]",
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36), ["--h" as string]: hue(seed ?? name ?? "") }}
    >
      {initials(name)}
    </span>
  );
}

/** Overlapping faces with a "+N" chip. Set `--ring` on a parent to match the background. */
export function Faces({
  people,
  total,
  max = 5,
  size = 28,
  chipClassName,
}: {
  people: Face[];
  total?: number;
  max?: number;
  size?: number;
  chipClassName?: string;
}) {
  const shown = people.slice(0, max);
  const extra = (total ?? people.length) - shown.length;
  if (shown.length === 0) return null;
  return (
    <div className="flex items-center">
      {shown.map((p, i) => (
        <span key={p.id + i} style={{ marginLeft: i ? -Math.round(size * 0.22) : 0 }} className="inline-flex">
          <Avatar name={p.name} seed={p.id} photo={p.v} size={size} ring />
        </span>
      ))}
      {extra > 0 && (
        <span
          className={cn(
            "-ml-1.5 inline-grid h-[--s] min-w-[--s] place-items-center rounded-full bg-surface-2 px-1.5 font-mono text-[11px] font-medium text-ink-2 ring-2 ring-[var(--ring,var(--bg))]",
            chipClassName,
          )}
          style={{ ["--s" as string]: `${size}px` }}
        >
          +{extra}
        </span>
      )}
    </div>
  );
}
