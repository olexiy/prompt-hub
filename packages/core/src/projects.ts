/**
 * Request schemas and response shapes of the projects/prompts API, shared by the API (validation)
 * and the web app (forms, typed responses). Limits mirror the database checks.
 */
import { z } from "zod";
import { isValidSlug } from "./slug";
import { MAX_PROMPT_BODY, variableDefsSchema, type VariableDef } from "./variables";

const slug = z.string().refine(isValidSlug, "Invalid slug");

export const projectCreateSchema = z.strictObject({
  slug,
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(1000).default(""),
});
export type ProjectCreate = z.input<typeof projectCreateSchema>;

export const promptCreateSchema = z.strictObject({
  slug,
  title: z.string().trim().min(1).max(200),
  body: z.string().max(MAX_PROMPT_BODY),
  variables: variableDefsSchema.default([]),
});
export type PromptCreate = z.input<typeof promptCreateSchema>;

export type Visibility = "PRIVATE" | "PUBLIC";

export interface ProjectSummary {
  slug: string;
  name: string;
  description: string;
  visibility: Visibility;
  promptCount: number;
  updatedAt: string;
}

export interface PromptSummary {
  slug: string;
  title: string;
  updatedAt: string;
}

export interface PromptDetail extends PromptSummary {
  version: {
    number: number;
    body: string;
    variables: VariableDef[];
    createdAt: string;
  };
}

export interface ProjectDetail extends ProjectSummary {
  owner: string;
  prompts: PromptSummary[];
}
