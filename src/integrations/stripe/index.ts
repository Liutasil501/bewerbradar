import Stripe from "stripe";

const getStripeSecretKey = () => {
	return process.env.STRIPE_SECRET_KEY || "";
};

export const stripe = new Stripe(getStripeSecretKey(), {
	apiVersion: "2023-10-16" as any, // fallback for different types locally
});
