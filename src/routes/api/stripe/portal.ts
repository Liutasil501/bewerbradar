import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@/integrations/auth/config";
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

		// @ts-expect-error
		const currentUser = session.user as any;
		const stripeCustomerId = currentUser.stripeCustomerId;

		if (!stripeCustomerId) {
			return Response.json({ error: "No active Premium subscription found." }, { status: 400 });
		}

		const portalSession = await stripe.billingPortal.sessions.create({
			customer: stripeCustomerId,
			return_url: `${process.env.APP_URL}/dashboard/settings`,
		});

		return Response.json({ url: portalSession.url });
	} catch (error) {
		console.error("Portal error:", error);
		return new Response("Internal Server Error", { status: 500 });
	}
}

export const Route = createFileRoute("/api/stripe/portal")({
	server: {
		handlers: {
			POST: handler,
		},
	},
});
