CREATE TABLE "activities" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"date" timestamp with time zone NOT NULL,
	"distance_m" integer DEFAULT 0 NOT NULL,
	"moving_time_s" integer DEFAULT 0 NOT NULL,
	"elapsed_time_s" integer DEFAULT 0 NOT NULL,
	"elevation_gain_m" integer DEFAULT 0 NOT NULL,
	"avg_speed_mps" real DEFAULT 0 NOT NULL,
	"route_points" json DEFAULT '[]'::json NOT NULL,
	"has_gps" boolean DEFAULT false NOT NULL,
	"athlete_name" text NOT NULL,
	"athlete_avatar_url" text,
	"athlete_handle" text,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;