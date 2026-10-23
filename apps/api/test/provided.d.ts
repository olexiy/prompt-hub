/** Values the global setup (test-setup/global-setup.ts) hands to the Workers tests. */
declare module "vitest" {
  export interface ProvidedContext {
    testUser: { email: string; password: string };
  }
}

export {};
