ALTER TABLE "user" ADD COLUMN "has_active_subscription" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "stripe_customer_id" text;