import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import { schema } from "@/integrations/drizzle";
import { db } from "@/integrations/drizzle/client";
import { stripe } from "@/integrations/stripe";

async function handler({ request }: { request: Request }) {
	if (request.method !== "POST") {
		return new Response("Method Not Allowed", { status: 405 });
	}

	const signature = request.headers.get("stripe-signature");
	const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

	if (!signature || !webhookSecret) {
		return new Response("Webhook secret not set", { status: 400 });
	}

	const body = await request.text();
	let event: Stripe.Event;

	try {
		event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
	} catch (err: unknown) {
		const errorMessage = err instanceof Error ? err.message : String(err);
		console.error(`Webhook Error: ${errorMessage}`);
		return new Response(`Webhook Error: ${errorMessage}`, { status: 400 });
	}

	if (event.type === "checkout.session.completed") {
		const session = event.data.object as Stripe.Checkout.Session;
		const userId = session.metadata?.userId;

		if (userId) {
			// Payment was successful, give user premium status
			await (await db).update(schema.user).set({ hasActiveSubscription: true }).where(eq(schema.user.id, userId));

			console.log(`Payment successful for user ${userId}. Subscription updated.`);
		}
	} else if (event.type === "customer.subscription.deleted") {
		// Find user by stripe customer id and revoke premium status
		const subscription = event.data.object as Stripe.Subscription;
		const stripeCustomerId = subscription.customer as string;

		if (stripeCustomerId) {
			await (await db)
				.update(schema.user)
				.set({ hasActiveSubscription: false })
				.where(eq(schema.user.stripeCustomerId, stripeCustomerId));

			console.log(`Subscription deleted for customer ${stripeCustomerId}. Premium access revoked.`);
		}
	}

	return new Response(JSON.stringify({ received: true }), {
		status: 200,
		headers: {
			"Content-Type": "application/json",
		},
	});
}

export const Route = createFileRoute("/api/stripe/webhook")({
	server: {
		handlers: {
			POST: handler,
		},
	},
});
