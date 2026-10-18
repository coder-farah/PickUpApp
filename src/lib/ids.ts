import { randomBytes } from "node:crypto";

const ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";

/** Short, unambiguous random id for share links. */
export function shortCode(length = 7) {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

export function slugify(input: string) {
  return (
    input
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "group"
  );
}
