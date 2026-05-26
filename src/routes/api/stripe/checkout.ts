import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { auth } from "@/integrations/auth/config";
import { schema } from "@/integrations/drizzle";
import { db } from "@/integrations/drizzle/client";
import { stripe } from "@/integrations/stripe";

async function handler({ request }: { request: Request }) {
	if (request.method !== "POST") {
		return new Response("Method Not Allowed", { status: 405 });
	}

	try {
		const session = await auth.api.getSession({
			headers: request.headers,
		});

		if (!session?.user) {
			return new Response("Unauthorized", { status: 401 });
		}

		// @ts-expect-error - stripeCustomerId is injected via schema but session types might not reflect it
		const currentUser = session.user as any;

		let stripeCustomerId = currentUser.stripeCustomerId;

		if (!stripeCustomerId) {
			const customer = await stripe.customers.create({
				email: currentUser.email,
				name: currentUser.name,
			});
			stripeCustomerId = customer.id;

			await (await db).update(schema.user).set({ stripeCustomerId }).where(eq(schema.user.id, currentUser.id));
		}

		const checkoutSession = await stripe.checkout.sessions.create({
			customer: stripeCustomerId,
			payment_method_types: ["card", "paypal"],
			line_items: [
				{
					price: process.env.STRIPE_PRICE_ID,
					quantity: 1,
				},
			],
			mode: "subscription",
			success_url: `${process.env.APP_URL}/dashboard/resumes`,
			cancel_url: `${process.env.APP_URL}/dashboard`,
			metadata: {
				userId: currentUser.id,
			},
		});

		return Response.json({ url: checkoutSession.url });
	} catch (error) {
		console.error(error);
		return new Response("Internal Server Error", { status: 500 });
	}
}

export const Route = createFileRoute("/api/stripe/checkout")({
	server: {
		handlers: {
			POST: handler,
		},
	},
});
