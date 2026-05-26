import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { CircleNotchIcon, FileJsIcon, FilePdfIcon } from "@phosphor-icons/react";
import { useMutation } from "@tanstack/react-query";
import { useCallback } from "react";
import { toast } from "sonner";
import { useResumeStore } from "@/components/resume/store/resume";
import { Button } from "@/components/ui/button";
import { orpc } from "@/integrations/orpc/client";
import { downloadFromUrl, downloadWithAnchor, generateFilename } from "@/utils/file";
import { SectionBase } from "../shared/section-base";

export function ExportSectionBuilder() {
	const resume = useResumeStore((state) => state.resume);

	const { mutateAsync: printResumeAsPDF, isPending: isPrinting } = useMutation(
		orpc.printer.printResumeAsPDF.mutationOptions(),
	);

	const onDownloadJSON = useCallback(() => {
		const filename = generateFilename(resume.data.basics.name, "json");
		const jsonString = JSON.stringify(resume.data, null, 2);
		const blob = new Blob([jsonString], { type: "application/json" });

		downloadWithAnchor(blob, filename);
	}, [resume]);

	const onDownloadPDF = useCallback(async () => {
		const filename = generateFilename(resume.data.basics.name, "pdf");

		// STRIPE PAYMENT WALL
		const response = await fetch("/api/auth/session");
		const sessionData = await response.json();

		if (!sessionData?.user) {
			toast.error(t`You must be logged in to download PDFs.`);
			return;
		}

		if (!sessionData.user.hasActiveSubscription) {
			const checkoutId = toast.loading(t`Redirecting to checkout...`);
			try {
				const res = await fetch("/api/stripe/checkout", { method: "POST" });
				const { url } = await res.json();
				if (url) {
					window.location.href = url;
					return;
				}
			} catch (error) {
				toast.error(t`Failed to initialize checkout. Please try again.`);
			} finally {
				toast.dismiss(checkoutId);
			}
			return;
		}

		const toastId = toast.loading(t`Please wait while your PDF is being generated...`, {
			description: t`This may take a while depending on the server capacity. Please do not close the window or refresh the page.`,
		});

		try {
			const { url } = await printResumeAsPDF({ id: resume.id });
			downloadFromUrl(url, filename);
		} catch {
			toast.error(t`There was a problem while generating the PDF, please try again in some time.`);
		} finally {
			toast.dismiss(toastId);
		}
	}, [resume, printResumeAsPDF]);

	const onManageSubscription = useCallback(async () => {
		const toastId = toast.loading(t`Redirecting to Stripe Portal...`);
		try {
			const res = await fetch("/api/stripe/portal", { method: "POST" });
			const { url } = await res.json();
			if (url) {
				window.location.href = url;
			}
		} catch (error) {
			toast.error(t`Failed to open subscription portal. Please try again.`);
		} finally {
			toast.dismiss(toastId);
		}
	}, []);

	return (
		<SectionBase type="export" className="space-y-4">
			<Button
				variant="outline"
				onClick={onDownloadJSON}
				className="h-auto gap-x-4 whitespace-normal p-4! text-start font-normal active:scale-98"
			>
				<FileJsIcon className="size-6 shrink-0" />
				<div className="flex flex-1 flex-col gap-y-1">
					<h6 className="font-medium">JSON</h6>
					<p className="text-muted-foreground text-xs leading-normal">
						<Trans>
							Download a copy of your resume in JSON format. Use this file for backup or to import your resume into
							other applications, including AI assistants.
						</Trans>
					</p>
				</div>
			</Button>

			<Button
				variant="outline"
				disabled={isPrinting}
				onClick={onDownloadPDF}
				className="h-auto gap-x-4 whitespace-normal p-4! text-start font-normal active:scale-98"
			>
				{isPrinting ? (
					<CircleNotchIcon className="size-6 shrink-0 animate-spin" />
				) : (
					<FilePdfIcon className="size-6 shrink-0" />
				)}

				<div className="flex flex-1 flex-col gap-y-1">
					<h6 className="font-medium">PDF</h6>
					<p className="text-muted-foreground text-xs leading-normal">
						<Trans>
							Download a copy of your resume in PDF format. Use this file for printing or to easily share your resume
							with recruiters.
						</Trans>
					</p>
				</div>
			</Button>

			<Button
				variant="outline"
				onClick={onManageSubscription}
				className="h-auto gap-x-4 whitespace-normal p-4! text-start font-normal active:scale-98"
			>
				<div className="flex flex-1 flex-col gap-y-1">
					<h6 className="font-medium text-primary">Manage Subscription</h6>
					<p className="text-muted-foreground text-xs leading-normal">
						<Trans>View invoices, update payment methods, or cancel your Premium Subscription.</Trans>
					</p>
				</div>
			</Button>
		</SectionBase>
	);
}
