CREATE TABLE "invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"inviter_id" uuid NOT NULL,
	"phone" text NOT NULL,
	"name" text,
	"game_id" uuid,
	"sent_at" timestamp with time zone,
	"accepted_by" uuid,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invites_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "games" ALTER COLUMN "capacity" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "schedules" ALTER COLUMN "capacity" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "phone" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "lat" double precision;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "lng" double precision;--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN "lat" double precision;--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN "lng" double precision;--> statement-breakpoint
ALTER TABLE "schedules" ADD COLUMN "lat" double precision;--> statement-breakpoint
ALTER TABLE "schedules" ADD COLUMN "lng" double precision;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "apple_sub" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "username" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "avatar" "bytea";--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "avatar_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "area_label" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "area_lat" double precision;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "area_lng" double precision;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "area_miles" integer DEFAULT 10 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "onboarded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_inviter_id_users_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_accepted_by_users_id_fk" FOREIGN KEY ("accepted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invites_inviter_idx" ON "invites" USING btree ("inviter_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "invites_inviter_phone_uq" ON "invites" USING btree ("inviter_id","phone");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_apple_sub_unique" UNIQUE("apple_sub");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_username_unique" UNIQUE("username");--> statement-breakpoint
UPDATE "users" SET "onboarded_at" = "created_at" WHERE "name" IS NOT NULL;