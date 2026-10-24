/**
 * Every error the API answers with (#36): a stable code and the English message. The API sends
 * `{ error, code }`; the web app shows its own translation of the code (en/ru/de) and falls back
 * to the English message for codes it does not know (an older tab, a newer API).
 */
export const API_ERRORS = {
  generic: "Something went wrong",
  invalidRequest: "Invalid request",
  unauthorized: "Unauthorized",
  forbidden: "Forbidden",
  notFound: "Not found",
  expectedJson: "Expected JSON",
  tooLarge: "Request body is too large",
  tooManyRequests: "Too many requests. Try again in a minute.",
  staleClient: "A new version of the app is available. Reload the page.",
  badCredentials: "Email or password is wrong",
  enterCredentials: "Enter an email and a password",
  enterEmail: "Enter a valid email",
  weakPassword: "Use at least 12 characters",
  invalidLink: "Invalid link",
  expiredLink: "The link is invalid or has expired",
  badPrefs: "Unknown language or theme",
  checkProject: "Check the project name and URL slug",
  checkProjectSettings: "Check the project settings",
  checkFolder: "Check the folder name and URL slug",
  checkNewPrompt: "Check the title, URL slug and text",
  checkCopy: "Check the title and URL slug",
  checkPromptText: "Check the prompt text and variables",
  checkArchive: "Check the archive contents",
  invalidChange: "Invalid change",
  projectSlugTaken: "You already have a project with this URL slug",
  itemSlugTaken: "This folder already has a prompt or folder with this URL slug",
  tooDeep: "Folders cannot be nested deeper",
  concurrentSave: "Saved at the same time elsewhere. Reload and try again.",
  lastVersion: "A prompt keeps at least one version",
} as const;

export type ApiErrorCode = keyof typeof API_ERRORS;

/** The JSON body of an error response. */
export const errorBody = (code: ApiErrorCode) => ({ error: API_ERRORS[code], code });

export function isApiErrorCode(value: unknown): value is ApiErrorCode {
  return typeof value === "string" && Object.hasOwn(API_ERRORS, value);
}
