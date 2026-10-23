/** `app_user` rows for Supabase users, created on first sign-in. */
import { isValidSlug, suggestSlug } from "@prompt-hub/core";
import { appUser, eq, type Db } from "@prompt-hub/db";
import type { AccessClaims } from "./jwt";

export type AppUser = typeof appUser.$inferSelect;

/** Handle from the e-mail's local part ("ol.sakura@…" → "ol-sakura"), made unique with a suffix. */
async function freeHandle(db: Db, email: string): Promise<string> {
  const base = suggestSlug(email.split("@")[0] ?? "").slice(0, 56) || "user";
  for (let n = 1; n < 1000; n++) {
    const handle = n === 1 ? base : `${base}-${String(n)}`;
    if (!isValidSlug(handle)) continue;
    const taken = await db
      .select({ id: appUser.id })
      .from(appUser)
      .where(eq(appUser.handle, handle));
    if (taken.length === 0) return handle;
  }
  throw new Error("No free handle");
}

export async function ensureAppUser(db: Db, claims: AccessClaims): Promise<AppUser> {
  const [existing] = await db.select().from(appUser).where(eq(appUser.id, claims.sub));
  if (existing) return existing;
  const handle = await freeHandle(db, claims.email);
  const [created] = await db
    .insert(appUser)
    .values({ id: claims.sub, handle })
    .onConflictDoNothing({ target: appUser.id })
    .returning();
  if (created) return created;
  // A parallel first request created it.
  const [row] = await db.select().from(appUser).where(eq(appUser.id, claims.sub));
  if (!row) throw new Error("app_user missing after insert");
  return row;
}
