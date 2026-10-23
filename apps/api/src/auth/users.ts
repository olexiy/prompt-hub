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
  // Parallel first requests of a new user race here: both may pick the same free handle. Any
  // conflict (id or handle) is ignored, then the row is read back by id; if another user took
  // the handle in between, the next attempt picks a new one.
  for (let attempt = 0; attempt < 3; attempt++) {
    const [existing] = await db.select().from(appUser).where(eq(appUser.id, claims.sub));
    if (existing) return existing;
    const handle = await freeHandle(db, claims.email);
    const [created] = await db
      .insert(appUser)
      .values({ id: claims.sub, handle })
      .onConflictDoNothing()
      .returning();
    if (created) return created;
  }
  throw new Error("app_user could not be created");
}
