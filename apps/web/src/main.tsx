import "@primer/primitives/dist/css/primitives.css";
import "@primer/primitives/dist/css/functional/themes/light.css";
import "@primer/primitives/dist/css/functional/themes/dark.css";
// Global page CSS lives in a file: the CSP allows no inline <style> in index.html.
import "./global.css";
import { BaseStyles } from "@primer/react";
import { ThemeProvider } from "@primer/react/next";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

const root = document.getElementById("root");
if (!root) throw new Error("#root element missing in index.html");

createRoot(root).render(
  <StrictMode>
    {/* colorMode "auto" follows the OS until the user picks a theme (#24). */}
    <ThemeProvider colorMode="auto">
      {/* Theme variables live on the provider's element, so it paints the page background itself. */}
      <BaseStyles style={{ minHeight: "100vh", backgroundColor: "var(--bgColor-default)" }}>
        <App />
      </BaseStyles>
    </ThemeProvider>
  </StrictMode>,
);
