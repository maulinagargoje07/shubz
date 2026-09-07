CREATE TYPE "public"."lead_status" AS ENUM('NEW', 'CONTACTED', 'INTERESTED', 'NOT_INTERESTED', 'CONVERTED');--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "lead_status" "lead_status" DEFAULT 'NEW' NOT NULL;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "trading_experience" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "lead_captured_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "contacts_lead_status_idx" ON "contacts" USING btree ("lead_status");--> statement-breakpoint
CREATE INDEX "contacts_lead_captured_at_idx" ON "contacts" USING btree ("lead_captured_at");