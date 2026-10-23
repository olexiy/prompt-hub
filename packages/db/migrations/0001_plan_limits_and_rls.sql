-- Plan limits (feature 76): Free 25 projects / 250 prompts in total, Pro unlimited (NULL).
INSERT INTO "plan_limit" ("plan", "max_projects", "max_prompts") VALUES
	('FREE', 25, 250),
	('PRO', NULL, NULL)
ON CONFLICT ("plan") DO NOTHING;
--> statement-breakpoint
-- Defence in depth: the Worker is the only data path and connects as the table owner
-- (which bypasses RLS). Row Level Security with no policies denies every other role, so
-- even if Supabase's Data API were switched on, anon/authenticated clients would see nothing.
ALTER TABLE "app_user" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "project" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "folder" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "prompt" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "prompt_version" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tag" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "project_tag" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "prompt_tag" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "invite" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "plan_limit" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
-- Supabase's API roles get no table privileges at all (the roles exist only on Supabase).
DO $$
BEGIN
	IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
		REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
	END IF;
	IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
		REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated;
	END IF;
END $$;
