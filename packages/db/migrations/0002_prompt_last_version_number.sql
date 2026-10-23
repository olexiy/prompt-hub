ALTER TABLE "prompt" ADD COLUMN "last_version_number" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- Backfill: existing prompts continue after their highest existing version number.
UPDATE "prompt" SET "last_version_number" = coalesce((SELECT max("number") FROM "prompt_version" WHERE "prompt_version"."prompt_id" = "prompt"."id"), 0);
