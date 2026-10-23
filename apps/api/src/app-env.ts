import type { Db } from "@prompt-hub/db";
import type { AppUser } from "./auth/users";

/** Hono context types: Worker bindings plus per-request values set by middleware. */
export interface AppEnv {
  Bindings: Env;
  Variables: { db: Db; user: AppUser };
}
