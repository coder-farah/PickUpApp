export const USERNAME_RE = /^[a-z0-9._]{3,20}$/;

/** "@Pooya.F " → "pooya.f" */
export function normalizeUsername(input: string) {
  return input.trim().replace(/^@+/, "").toLowerCase();
}

export function usernameProblem(u: string): string | null {
  if (u.length < 3) return "Use at least 3 characters.";
  if (u.length > 20) return "Use 20 characters or fewer.";
  if (!USERNAME_RE.test(u)) return "Use letters, numbers, dots and underscores.";
  if (/^[._]|[._]$/.test(u) || /[._]{2}/.test(u)) return "Dots and underscores go between letters.";
  return null;
}

/** Candidates to offer when a username is taken: pooya → pooya.f, pooya.f1, pooya_fc, pooya2… */
export function usernameCandidates(base: string, name?: string | null) {
  const clean = base.replace(/[^a-z0-9._]/g, "").replace(/^[._]+|[._]+$/g, "").slice(0, 16) || "player";
  const parts = (name ?? "").toLowerCase().split(/\s+/).filter(Boolean);
  const initial = parts.length > 1 ? parts[parts.length - 1].replace(/[^a-z]/g, "")[0] : undefined;
  const out = [initial && `${clean}.${initial}`, `${clean}.fc`, `${clean}_plays`, ...[2, 7, 10, 11, 22].map((n) => `${clean}${n}`)];
  return out.filter((c): c is string => !!c && !usernameProblem(c));
}
