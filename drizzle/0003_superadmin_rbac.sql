ALTER TYPE "public"."user_role" ADD VALUE 'SUPERADMIN' BEFORE 'ADMIN';--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "permissions" jsonb;