import { t } from "@lingui/core/macro";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/settings/billing")({
	component: BillingSettingsPage,
});

function BillingSettingsPage() {
	const router = useRouter();

	useEffect(() => {
		const openPortal = async () => {
			const toastId = toast.loading(t`Redirecting to Stripe Portal...`);
			try {
				const res = await fetch("/api/stripe/portal", { method: "POST" });
				const data = await res.json();

				if (!res.ok) {
					toast.error(data.error || t`Failed to load Stripe Portal.`);
					router.navigate({ to: "/dashboard/resumes" });
					return;
				}

				if (data.url) {
					window.location.href = data.url;
				}
			} catch (error) {
				toast.error(t`Failed to open subscription portal. Please try again.`);
			} finally {
				toast.dismiss(toastId);
			}
		};

		openPortal();
	}, [router]);

	return (
		<div className="flex h-full items-center justify-center">
			<p className="text-muted-foreground">Redirecting...</p>
		</div>
	);
}
