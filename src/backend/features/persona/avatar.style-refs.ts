import "server-only";
import fs from "fs";
import path from "path";
import {
  AVATAR_STYLE_REF_BY_ANIMAL,
  AVATAR_STYLE_REF_FILES,
} from "./avatar.prompt";

function readStyleRefBase64(name: string): string | null {
  const candidates = [
    path.join(process.cwd(), "public", "avatar-style-refs", name),
    path.join(process.cwd(), "avatar-style-refs", name),
    path.join(
      process.cwd(),
      "src",
      "backend",
      "features",
      "persona",
      "style-refs",
      name
    ),
  ];

  for (const file of candidates) {
    try {
      if (fs.existsSync(file)) {
        return fs.readFileSync(file).toString("base64");
      }
    } catch {
      /* try next */
    }
  }

  console.warn(`[avatar] style ref missing: ${name}`);
  return null;
}

/**
 * Resolve preschool crayon style-reference by companion animal.
 */
export function loadAvatarStyleRefForAnimal(
  animal: keyof typeof AVATAR_STYLE_REF_BY_ANIMAL
): string | null {
  return readStyleRefBase64(AVATAR_STYLE_REF_BY_ANIMAL[animal]);
}

/**
 * Fallback: resolve by rotating index across the eight animal refs.
 */
export function loadAvatarStyleRefBase64(index = 0): string | null {
  const name =
    AVATAR_STYLE_REF_FILES[
      Math.abs(index) % AVATAR_STYLE_REF_FILES.length
    ]!;
  return readStyleRefBase64(name);
}
