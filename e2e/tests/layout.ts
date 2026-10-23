import { expect, type Page } from "@playwright/test";

/**
 * The page fits the screen: no sideways scrolling, and on phone widths every form field is at
 * least 16px (iOS Safari zooms into smaller fields on focus and the page then pans, #45).
 */
export async function expectFitsScreen(page: Page): Promise<void> {
  const { scrollWidth, clientWidth, smallFields } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    smallFields:
      window.innerWidth <= 860
        ? [...document.querySelectorAll("input, textarea, select")]
            .filter((el) => parseFloat(getComputedStyle(el).fontSize) < 16)
            .map((el) => el.getAttribute("aria-label") ?? el.id)
        : [],
  }));
  expect(scrollWidth, "page wider than the screen").toBeLessThanOrEqual(clientWidth);
  expect(smallFields, "form fields under 16px on a phone").toEqual([]);
}
