import { eq } from "drizzle-orm";
import { auth } from "@reactive-resume/auth/config";
import { db } from "@reactive-resume/db/client";
import { user } from "@reactive-resume/db/schema";
import { env } from "@reactive-resume/env/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

export async function handleStripeCheckout(request: Request) {
	if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

	try {
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session?.user) return new Response("Unauthorized", { status: 401 });

		const currentUser = session.user as any;
		let stripeCustomerId = currentUser.stripeCustomerId;

		if (!stripeCustomerId) {
			const customer = await stripe.customers.create({
				email: currentUser.email,
				name: currentUser.name,
			});
			stripeCustomerId = customer.id;
			await db.update(user).set({ stripeCustomerId }).where(eq(user.id, currentUser.id));
		}

		const checkoutSession = await stripe.checkout.sessions.create({
			customer: stripeCustomerId,
			payment_method_types: ["card", "paypal"],
			line_items: [
				{
					price: process.env.STRIPE_PRICE_ID as string,
					quantity: 1,
				},
			],
			mode: "subscription",
			success_url: `${env.APP_URL}/dashboard/resumes`,
			cancel_url: `${env.APP_URL}/dashboard`,
			metadata: { userId: currentUser.id },
		});

		return Response.json({ url: checkoutSession.url });
	} catch (error) {
		console.error(error);
		return new Response("Internal Server Error", { status: 500 });
	}
}

export async function handleStripePortal(request: Request) {
	if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

	try {
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session?.user) return new Response("Unauthorized", { status: 401 });

		const currentUser = session.user as any;
		const stripeCustomerId = currentUser.stripeCustomerId;

		if (!stripeCustomerId) {
			return Response.json({ error: "No active Premium subscription found." }, { status: 400 });
		}

		const portalSession = await stripe.billingPortal.sessions.create({
			customer: stripeCustomerId,
			return_url: `${env.APP_URL}/dashboard/settings`,
		});

		return Response.json({ url: portalSession.url });
	} catch (error) {
		console.error("Portal error:", error);
		return new Response("Internal Server Error", { status: 500 });
	}
}

export async function handleStripeWebhook(request: Request) {
	if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

	const signature = request.headers.get("stripe-signature");
	const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

	if (!signature || !webhookSecret) return new Response("Webhook secret not set", { status: 400 });

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
			await db.update(user).set({ hasActiveSubscription: true }).where(eq(user.id, userId));
			console.log(`Payment successful for user ${userId}. Subscription updated.`);
		}
	} else if (event.type === "customer.subscription.deleted") {
		const subscription = event.data.object as Stripe.Subscription;
		const stripeCustomerId = subscription.customer as string;

		if (stripeCustomerId) {
			await db.update(user).set({ hasActiveSubscription: false }).where(eq(user.stripeCustomerId, stripeCustomerId));
			console.log(`Subscription deleted for customer ${stripeCustomerId}. Premium access revoked.`);
		}
	}

	return new Response(JSON.stringify({ received: true }), { status: 200, headers: { "Content-Type": "application/json" } });
}
