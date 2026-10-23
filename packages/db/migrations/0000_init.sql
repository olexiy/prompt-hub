CREATE TABLE "app_user" (
	"id" uuid PRIMARY KEY NOT NULL,
	"handle" text NOT NULL,
	"display_name" text DEFAULT '' NOT NULL,
	"locale" text DEFAULT 'en' NOT NULL,
	"theme" text DEFAULT 'system' NOT NULL,
	"plan" text DEFAULT 'FREE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "app_user_handle_unique" UNIQUE("handle"),
	CONSTRAINT "app_user_handle_check" CHECK ("app_user"."handle" ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length("app_user"."handle") <= 64),
	CONSTRAINT "app_user_locale_check" CHECK ("app_user"."locale" in ('en', 'ru', 'de')),
	CONSTRAINT "app_user_theme_check" CHECK ("app_user"."theme" in ('system', 'light', 'dark')),
	CONSTRAINT "app_user_plan_check" CHECK ("app_user"."plan" in ('FREE', 'PRO')),
	CONSTRAINT "app_user_display_name_length" CHECK (length("app_user"."display_name") <= 100)
);
--> statement-breakpoint
CREATE TABLE "folder" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_id" uuid NOT NULL,
	"parent_id" uuid,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "folder_parent_slug_key" UNIQUE NULLS NOT DISTINCT("project_id","parent_id","slug"),
	CONSTRAINT "folder_slug_check" CHECK ("folder"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length("folder"."slug") <= 64),
	CONSTRAINT "folder_name_length" CHECK (length("folder"."name") between 1 and 100)
);
--> statement-breakpoint
CREATE TABLE "invite" (
	"id" uuid PRIMARY KEY NOT NULL,
	"code_hash" text NOT NULL,
	"created_by" uuid NOT NULL,
	"email" text,
	"expires_at" timestamp with time zone NOT NULL,
	"used_by" uuid,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invite_code_hash_unique" UNIQUE("code_hash")
);
--> statement-breakpoint
CREATE TABLE "plan_limit" (
	"plan" text PRIMARY KEY NOT NULL,
	"max_projects" integer,
	"max_prompts" integer,
	CONSTRAINT "plan_limit_plan_check" CHECK ("plan_limit"."plan" in ('FREE', 'PRO'))
);
--> statement-breakpoint
CREATE TABLE "project" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"visibility" text DEFAULT 'PRIVATE' NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"search" "tsvector" GENERATED ALWAYS AS (to_tsvector('simple', "project"."name" || ' ' || "project"."description")) STORED,
	CONSTRAINT "project_owner_slug_key" UNIQUE("owner_id","slug"),
	CONSTRAINT "project_slug_check" CHECK ("project"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length("project"."slug") <= 64),
	CONSTRAINT "project_visibility_check" CHECK ("project"."visibility" in ('PRIVATE', 'PUBLIC')),
	CONSTRAINT "project_name_length" CHECK (length("project"."name") between 1 and 100),
	CONSTRAINT "project_description_length" CHECK (length("project"."description") <= 1000)
);
--> statement-breakpoint
CREATE TABLE "project_tag" (
	"project_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "project_tag_project_id_tag_id_pk" PRIMARY KEY("project_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "prompt" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_id" uuid NOT NULL,
	"folder_id" uuid,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"type" text DEFAULT 'TEXT' NOT NULL,
	"current_version_id" uuid,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"search" "tsvector" GENERATED ALWAYS AS (to_tsvector('simple', "prompt"."title")) STORED,
	CONSTRAINT "prompt_folder_slug_key" UNIQUE NULLS NOT DISTINCT("project_id","folder_id","slug"),
	CONSTRAINT "prompt_slug_check" CHECK ("prompt"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length("prompt"."slug") <= 64),
	CONSTRAINT "prompt_type_check" CHECK ("prompt"."type" in ('TEXT', 'CHAT', 'MEDIA')),
	CONSTRAINT "prompt_title_length" CHECK (length("prompt"."title") between 1 and 200)
);
--> statement-breakpoint
CREATE TABLE "prompt_tag" (
	"prompt_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "prompt_tag_prompt_id_tag_id_pk" PRIMARY KEY("prompt_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "prompt_version" (
	"id" uuid PRIMARY KEY NOT NULL,
	"prompt_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"body" text NOT NULL,
	"sections" jsonb,
	"variables" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"message" text DEFAULT '' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"search" "tsvector" GENERATED ALWAYS AS (to_tsvector('simple', "prompt_version"."body")) STORED,
	CONSTRAINT "prompt_version_number_key" UNIQUE("prompt_id","number"),
	CONSTRAINT "prompt_version_number_positive" CHECK ("prompt_version"."number" > 0),
	CONSTRAINT "prompt_version_body_length" CHECK (length("prompt_version"."body") <= 100000),
	CONSTRAINT "prompt_version_message_length" CHECK (length("prompt_version"."message") <= 500)
);
--> statement-breakpoint
CREATE TABLE "tag" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "tag_owner_name_key" UNIQUE("owner_id","name"),
	CONSTRAINT "tag_name_check" CHECK ("tag"."name" ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length("tag"."name") <= 64)
);
--> statement-breakpoint
ALTER TABLE "folder" ADD CONSTRAINT "folder_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folder" ADD CONSTRAINT "folder_parent_id_folder_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."folder"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invite" ADD CONSTRAINT "invite_created_by_app_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."app_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invite" ADD CONSTRAINT "invite_used_by_app_user_id_fk" FOREIGN KEY ("used_by") REFERENCES "public"."app_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project" ADD CONSTRAINT "project_owner_id_app_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."app_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_tag" ADD CONSTRAINT "project_tag_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_tag" ADD CONSTRAINT "project_tag_tag_id_tag_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tag"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompt" ADD CONSTRAINT "prompt_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompt" ADD CONSTRAINT "prompt_folder_id_folder_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."folder"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompt" ADD CONSTRAINT "prompt_current_version_fk" FOREIGN KEY ("current_version_id") REFERENCES "public"."prompt_version"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompt_tag" ADD CONSTRAINT "prompt_tag_prompt_id_prompt_id_fk" FOREIGN KEY ("prompt_id") REFERENCES "public"."prompt"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompt_tag" ADD CONSTRAINT "prompt_tag_tag_id_tag_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tag"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompt_version" ADD CONSTRAINT "prompt_version_prompt_id_prompt_id_fk" FOREIGN KEY ("prompt_id") REFERENCES "public"."prompt"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompt_version" ADD CONSTRAINT "prompt_version_created_by_app_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."app_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tag" ADD CONSTRAINT "tag_owner_id_app_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."app_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_search_idx" ON "project" USING gin ("search");--> statement-breakpoint
CREATE INDEX "project_tag_tag_idx" ON "project_tag" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "prompt_search_idx" ON "prompt" USING gin ("search");--> statement-breakpoint
CREATE INDEX "prompt_folder_idx" ON "prompt" USING btree ("folder_id");--> statement-breakpoint
CREATE INDEX "prompt_tag_tag_idx" ON "prompt_tag" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "prompt_version_search_idx" ON "prompt_version" USING gin ("search");