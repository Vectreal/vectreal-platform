import { Alert, AlertDescription } from '@shared/components/ui/alert'
import { Button } from '@shared/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle
} from '@shared/components/ui/dialog'
import { AlertCircle, CheckCircle2, Copy } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { toast } from 'sonner'

/**
 * The one moment a key's plaintext exists outside the database.
 *
 * Keys are stored hashed, so this dialog is the only place the full value is
 * ever shown. It is shared by creation and rotation rather than duplicated,
 * because the two differ only in what the user has to do next - and after a
 * rotation that difference is the whole point: every embed still carrying the
 * previous secret is broken until it is updated.
 */

export type OneTimeKeyReason = 'created' | 'rotated'

export interface OneTimeKeyValue {
	plaintext: string
	preview: string
	name: string
}

const REASON_COPY: Record<
	OneTimeKeyReason,
	{ title: string; description: string; nextSteps: string[] }
> = {
	created: {
		title: 'API key created',
		description: 'Save this key now. It will not be shown again.',
		nextSteps: [
			'Copy the key above to a secure location',
			'Paste it into the Embed panel of a scene, or into your own request headers',
			'Add the site that will host the embed to the allowed domains for this project'
		]
	},
	rotated: {
		title: 'API key rotated',
		description:
			'The previous key stopped working the moment this one was issued.',
		nextSteps: [
			'Copy the key above to a secure location',
			'Replace the old key everywhere it is already deployed - every embed still carrying it is refused right now',
			'The Last Used column stays empty until something authenticates with the new key, which is how you confirm the update landed'
		]
	}
}

export function OneTimeKeyDialog({
	open,
	onClose,
	apiKey,
	reason
}: {
	open: boolean
	onClose: () => void
	apiKey: OneTimeKeyValue | null
	reason: OneTimeKeyReason
}) {
	const [copied, setCopied] = useState(false)
	const labelId = useId()
	const copy = REASON_COPY[reason]

	/*
	  `copied` is per-key, and this component is never remounted between keys:
	  the parent renders it continuously and only swaps `apiKey`, so state
	  survives every open and close.

	  Left alone, the copy button's 2-second "copied" window carries into the
	  next key. That key's dialog then opens already showing a checkmark, and
	  `handleClose` skips the "have you copied it?" confirmation because `copied`
	  is true - dismissing a plaintext that was never copied and cannot be shown
	  again. Rotating twice in quick succession is two clicks and a round trip.
	*/
	useEffect(() => {
		setCopied(false)
	}, [apiKey?.plaintext])

	const handleCopy = async () => {
		if (!apiKey) return

		try {
			await navigator.clipboard.writeText(apiKey.plaintext)
			setCopied(true)
			toast.success('API key copied to clipboard')
			setTimeout(() => setCopied(false), 2000)
		} catch (_error) {
			toast.error('Failed to copy to clipboard')
		}
	}

	const handleClose = () => {
		if (!copied) {
			const confirmed = window.confirm(
				'Have you copied your API key? This is the only time it will be displayed.'
			)
			if (!confirmed) return
		}
		onClose()
	}

	if (!apiKey) return null

	return (
		<Dialog open={open} onOpenChange={(next) => !next && handleClose()}>
			<DialogContent
				className="max-w-2xl"
				onEscapeKeyDown={(event) => event.preventDefault()}
			>
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<CheckCircle2 className="text-success size-5" />
						{copy.title}
					</DialogTitle>
					<DialogDescription>{copy.description}</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					<Alert
						variant="default"
						className="border-warning-border bg-warning-bg"
					>
						<AlertCircle className="text-warning size-4" />
						<AlertDescription className="text-warning-muted-foreground">
							<strong>Important:</strong> Copy this key now. Once you close this
							dialog the full key is no longer accessible, and only the preview
							(...{apiKey.preview}) remains.
						</AlertDescription>
					</Alert>

					<div className="space-y-2">
						<p className="text-h4" id={labelId}>
							{apiKey.name}
						</p>
						<div className="flex gap-2">
							<div
								aria-labelledby={labelId}
								className="text-muted-foreground bg-muted flex-1 rounded-md border p-3 font-mono text-sm break-all"
							>
								{apiKey.plaintext}
							</div>
							<Button
								type="button"
								variant={copied ? 'default' : 'outline'}
								size="icon"
								aria-label="Copy API key"
								className="shrink-0"
								onClick={handleCopy}
							>
								{copied ? (
									<CheckCircle2 className="size-4" />
								) : (
									<Copy className="size-4" />
								)}
							</Button>
						</div>
						<p className="text-muted-foreground text-xs">
							Key preview:{' '}
							<code className="font-mono">...{apiKey.preview}</code>
						</p>
					</div>

					<div className="bg-muted space-y-2 rounded-md p-4">
						<h4 className="text-h4">Next steps</h4>
						<ul className="text-muted-foreground list-inside list-disc space-y-1 text-sm">
							{copy.nextSteps.map((step) => (
								<li key={step}>{step}</li>
							))}
						</ul>
					</div>
				</div>

				<DialogFooter>
					<Button onClick={handleClose} className="w-full">
						I have saved my key
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
