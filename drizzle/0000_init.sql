CREATE TYPE "public"."game_status" AS ENUM('scheduled', 'open', 'on', 'cancelled', 'completed');--> statement-breakpoint
CREATE TYPE "public"."member_role" AS ENUM('organizer', 'member');--> statement-breakpoint
CREATE TYPE "public"."sport" AS ENUM('soccer', 'basketball', 'volleyball', 'ultimate', 'other');--> statement-breakpoint
CREATE TYPE "public"."spot_status" AS ENUM('in', 'waitlist', 'offered', 'out');--> statement-breakpoint
CREATE TYPE "public"."visibility" AS ENUM('public', 'private');--> statement-breakpoint
CREATE TABLE "games" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"group_id" uuid,
	"schedule_id" uuid,
	"host_id" uuid NOT NULL,
	"title" text NOT NULL,
	"sport" "sport" DEFAULT 'soccer' NOT NULL,
	"notes" text,
	"timezone" text DEFAULT 'America/Los_Angeles' NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"opens_at" timestamp with time zone NOT NULL,
	"decision_at" timestamp with time zone,
	"last_call_at" timestamp with time zone NOT NULL,
	"location_name" text NOT NULL,
	"location_address" text,
	"capacity" integer NOT NULL,
	"min_players" integer NOT NULL,
	"claim_minutes" integer DEFAULT 30 NOT NULL,
	"guests_allowed" boolean DEFAULT true NOT NULL,
	"visibility" "visibility" DEFAULT 'public' NOT NULL,
	"status" "game_status" DEFAULT 'open' NOT NULL,
	"cancel_reason" text,
	"decided_at" timestamp with time zone,
	"last_call_notified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "games_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "group_members" (
	"group_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "member_role" DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "group_members_group_id_user_id_pk" PRIMARY KEY("group_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"sport" "sport" DEFAULT 'soccer' NOT NULL,
	"description" text,
	"home_field" text,
	"area" text,
	"city" text DEFAULT 'San Francisco' NOT NULL,
	"timezone" text DEFAULT 'America/Los_Angeles' NOT NULL,
	"visibility" "visibility" DEFAULT 'public' NOT NULL,
	"invite_code" text NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "groups_slug_unique" UNIQUE("slug"),
	CONSTRAINT "groups_invite_code_unique" UNIQUE("invite_code")
);
--> statement-breakpoint
CREATE TABLE "login_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" text NOT NULL,
	"code_hash" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"game_id" uuid,
	"group_id" uuid,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"url" text,
	"sms_pending" boolean DEFAULT false NOT NULL,
	"sent_at" timestamp with time zone,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"title" text NOT NULL,
	"weekday" integer NOT NULL,
	"start_time" text NOT NULL,
	"duration_minutes" integer DEFAULT 90 NOT NULL,
	"location_name" text NOT NULL,
	"location_address" text,
	"capacity" integer NOT NULL,
	"min_players" integer NOT NULL,
	"opens_hours_before" integer DEFAULT 48 NOT NULL,
	"decision_hours_before" integer DEFAULT 4 NOT NULL,
	"claim_minutes" integer DEFAULT 30 NOT NULL,
	"last_call_hours" integer DEFAULT 3 NOT NULL,
	"guests_allowed" boolean DEFAULT true NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "spots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"guest_name" text,
	"status" "spot_status" NOT NULL,
	"queued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"offer_expires_at" timestamp with time zone,
	"confirmed_at" timestamp with time zone,
	"left_at" timestamp with time zone,
	"late_drop" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" text NOT NULL,
	"name" text,
	"sms_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_schedule_id_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."schedules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_host_id_users_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spots" ADD CONSTRAINT "spots_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spots" ADD CONSTRAINT "spots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "games_schedule_start_uq" ON "games" USING btree ("schedule_id","starts_at");--> statement-breakpoint
CREATE INDEX "games_starts_idx" ON "games" USING btree ("starts_at");--> statement-breakpoint
CREATE INDEX "games_group_idx" ON "games" USING btree ("group_id","starts_at");--> statement-breakpoint
CREATE INDEX "games_status_idx" ON "games" USING btree ("status");--> statement-breakpoint
CREATE INDEX "group_members_user_idx" ON "group_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "login_codes_phone_idx" ON "login_codes" USING btree ("phone","created_at");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "notifications_pending_idx" ON "notifications" USING btree ("sms_pending");--> statement-breakpoint
CREATE INDEX "schedules_group_idx" ON "schedules" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "spots_one_per_player_uq" ON "spots" USING btree ("game_id","user_id") WHERE "spots"."guest_name" is null;--> statement-breakpoint
CREATE INDEX "spots_game_status_idx" ON "spots" USING btree ("game_id","status","queued_at");--> statement-breakpoint
CREATE INDEX "spots_user_idx" ON "spots" USING btree ("user_id");