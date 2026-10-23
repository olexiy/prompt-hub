import { Heading } from "@primer/react";
import type { ReactNode } from "react";

/** Narrow centred card used by the sign-in and password screens (mockup: sign-in). */
export function AuthCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main
      style={{ maxWidth: 340, margin: "0 auto", padding: "48px 16px", display: "grid", gap: 16 }}
    >
      <Heading as="h1" style={{ fontSize: 24, fontWeight: 300, textAlign: "center" }}>
        {title}
      </Heading>
      <div
        style={{
          display: "grid",
          gap: 16,
          padding: 16,
          border: "1px solid var(--borderColor-default)",
          borderRadius: 6,
          background: "var(--bgColor-muted)",
        }}
      >
        {children}
      </div>
    </main>
  );
}
