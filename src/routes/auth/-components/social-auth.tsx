import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { GithubLogoIcon, GoogleLogoIcon, VaultIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { authClient } from "@/integrations/auth/client";
import { orpc } from "@/integrations/orpc/client";
import { cn } from "@/utils/style";

export function SocialAuth() {
	const router = useRouter();
	const { data: authProviders = {} } = useQuery(orpc.auth.providers.list.queryOptions());

	const handleSocialLogin = async (provider: string) => {
		const toastId = toast.loading(t`Signing in...`);

		const { error } = await authClient.signIn.social({
			provider,
			callbackURL: "/dashboard",
		});

		if (error) {
			toast.error(error.message, { id: toastId });
			return;
		}

		toast.dismiss(toastId);
		router.invalidate();
	};

	const handleOAuthLogin = async () => {
		const toastId = toast.loading(t`Signing in...`);

		const { error } = await authClient.signIn.oauth2({
			providerId: "custom",
			callbackURL: "/dashboard",
		});

		if (error) {
			toast.error(error.message, { id: toastId });
			return;
		}

		toast.dismiss(toastId);
		router.invalidate();
	};

	return (
		<>
			<div className="flex items-center gap-x-2">
				<hr className="flex-1" />
				<span className="font-medium text-xs tracking-wide">
					<Trans context="Choose to authenticate with a social provider (Google, GitHub, etc.) instead of email and password">
						or continue with
					</Trans>
				</span>
				<hr className="flex-1" />
			</div>

			<div>
				<div className="flex flex-col gap-3">
					<Button
						variant="secondary"
						onClick={handleOAuthLogin}
						className={cn("hidden w-full", "custom" in authProviders && "inline-flex")}
					>
						<VaultIcon />
						{authProviders.custom}
					</Button>

					<Button
						variant="outline"
						onClick={() => handleSocialLogin("google")}
						className={cn(
							"hidden w-full font-medium",
							"google" in authProviders && "flex items-center justify-center gap-2",
						)}
					>
						<GoogleLogoIcon className="w-5 h-5" />
						Mit Google anmelden
					</Button>

					<Button
						variant="outline"
						onClick={() => handleSocialLogin("github")}
						className={cn(
							"hidden w-full font-medium",
							"github" in authProviders && "flex items-center justify-center gap-2",
						)}
					>
						<GithubLogoIcon className="w-5 h-5" />
						Mit GitHub anmelden
					</Button>
				</div>
			</div>
		</>
	);
}
