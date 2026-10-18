ALTER TABLE "contacts" ADD COLUMN "assigned_to_user_id" uuid;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "assigned_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_assigned_to_user_id_user_id_fk" FOREIGN KEY ("assigned_to_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contacts_assigned_to_idx" ON "contacts" USING btree ("assigned_to_user_id","lead_status");