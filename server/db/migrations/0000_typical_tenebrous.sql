CREATE TABLE "forums" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "forums_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"parent_id" bigint,
	"name" text NOT NULL,
	"description" text,
	"position" integer DEFAULT 0 NOT NULL,
	"thread_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "posts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"thread_id" bigint NOT NULL,
	"user_id" bigint,
	"body_bbcode" text NOT NULL,
	"body_html_cache" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"edited_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "sessions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" bigint NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "threads" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "threads_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"forum_id" bigint NOT NULL,
	"user_id" bigint,
	"title" text NOT NULL,
	"reply_count" integer DEFAULT 0 NOT NULL,
	"last_post_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "users_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"username" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"avatar_url" text,
	"signature" text,
	"post_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
