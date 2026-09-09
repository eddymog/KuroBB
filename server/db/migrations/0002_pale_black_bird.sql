CREATE TABLE "forum_permissions" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "forum_permissions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"forum_id" bigint NOT NULL,
	"group_id" bigint NOT NULL,
	"can_view" boolean,
	"can_post" boolean,
	CONSTRAINT "forum_permissions_forum_id_group_id_unique" UNIQUE("forum_id","group_id")
);
--> statement-breakpoint
CREATE TABLE "groups" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "groups_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	CONSTRAINT "groups_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "user_groups" (
	"user_id" bigint NOT NULL,
	"group_id" bigint NOT NULL,
	CONSTRAINT "user_groups_user_id_group_id_pk" PRIMARY KEY("user_id","group_id")
);
