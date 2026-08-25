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
import { useEffect, useId, useRef, useState } from 'react'
import { toast } from 'sonner'

/**
 * The one moment a key's plaintext exists outside the database.
 *
 * Keys are stored hashed, so this dialog is the only place the full value is
 * ever shown, and it is the only one: the embed panel used to render a second
 * dialog for the same event, written to its own spec, and the two diverged
 * exactly where it mattered. That one carried `ph-no-capture`, without which
 * the live key is readable in any session replay; this one re-arms the copy
 * check on the plaintext itself, so a key that replaces another without a
 * dismissal in between - which is what rotating twice does - cannot inherit
 * its predecessor's checkmark. Both rules are here now.
 *
 * Creation and rotation share it because they differ only in what the user has
 * to do next - and after a rotation that difference is the whole point: every
 * embed still carrying the previous secret is broken until it is updated.
 *
 * The copy lives here rather than in `lib/domain/embed/embed-snippet.ts`. That
 * module describes the embed snippet, and a dialog the dashboard also opens
 * could not read from it without the dashboard depending on the embed domain.
 */

export type OneTimeKeyReason = 'created' | 'rotated'

export interface OneTimeKeyValue {
	plaintext: string
	preview: string
	name: string
	/**
	 * When the key stops working, if it ever does.
	 *
	 * Said at the one moment the user is definitely looking: this value is
	 * about to be pasted into a production storefront, and an embed that dies
	 * in three months with no warning is the expensive version of this
	 * conversation. Optional because the dashboard's create and rotate paths do
	 * not carry the expiry back to the client yet.
	 */
	expiresAt?: string | null
}

const COPY_FAILURE = 'Failed to copy the API key.'
const COPY_SUCCESS = 'API key copied to clipboard'
const CLIPBOARD_UNAVAILABLE = 'Clipboard is not available in this browser.'
const DISMISS_WITHOUT_COPY_CONFIRM =
	'Have you copied your API key? This is the only time it will be displayed.'

const REASON_COPY: Record<
	OneTimeKeyReason,
	{ title: string; description: string; nextSteps: string[] }
> = {
	created: {
		title: 'API key created',
		description:
			'This is the only time the full key is shown. It is stored hashed, so it cannot be read back.',
		nextSteps: [
			'Copy the key above to a secure location',
			'Paste it into the embed snippet, or into your own request headers',
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
	/*
	  Two facts, deliberately separate.

	  `copied` is whether the key has been copied at all, and it is what
	  suppresses the "are you sure?" on dismissal. `flashCopied` is only the
	  button's checkmark, which reverts after two seconds so the control reads
	  as pressable again.

	  One flag served both, and the timer cleared it: copy the key, spend three
	  seconds pasting it somewhere, then close - and the dialog asked whether it
	  had been copied, having watched it happen.
	*/
	const [copied, setCopied] = useState(false)
	const [flashCopied, setFlashCopied] = useState(false)
	const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
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
		setFlashCopied(false)

		// The previous key's checkmark timer, which would otherwise land inside
		// this key's two seconds and clear a checkmark it never set.
		return () => {
			if (flashTimer.current) clearTimeout(flashTimer.current)
		}
	}, [apiKey?.plaintext])

	const handleCopy = async () => {
		if (!apiKey) return

		if (!navigator?.clipboard) {
			toast.error(CLIPBOARD_UNAVAILABLE)
			return
		}

		try {
			await navigator.clipboard.writeText(apiKey.plaintext)
			setCopied(true)
			setFlashCopied(true)
			toast.success(COPY_SUCCESS)

			// Copying twice restarts the two seconds rather than letting the first
			// timer cut the second checkmark short.
			if (flashTimer.current) clearTimeout(flashTimer.current)
			flashTimer.current = setTimeout(() => setFlashCopied(false), 2000)
		} catch (error) {
			console.error('Failed to copy the API key:', error)
			toast.error(COPY_FAILURE)
		}
	}

	const handleClose = () => {
		if (!copied) {
			const confirmed = window.confirm(DISMISS_WITHOUT_COPY_CONFIRM)
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
						{/*
						  Scoped to what is true on both surfaces. "Once you close this
						  dialog the full key is no longer accessible" held on the
						  dashboard and not in the embed panel, where `use-embed-api-keys`
						  puts the plaintext into the token field, behind a reveal toggle,
						  for as long as that panel stays mounted. Stating the server-side
						  fact instead is true wherever this dialog opens, and it is the
						  one that costs money to learn late.
						*/}
						<AlertDescription className="text-warning-muted-foreground">
							<strong>Important:</strong> Copy this key now. It is stored
							hashed, so it can never be read back from Vectreal - once you
							leave this page, the preview (...{apiKey.preview}) is all that
							remains.
						</AlertDescription>
					</Alert>

					<div className="space-y-2">
						<p className="text-h4" id={labelId}>
							{apiKey.name}
						</p>
						<div className="flex gap-2">
							{/*
							  `ph-no-capture` keeps the key out of PostHog session replay.
							  Replay masks input values by default but not ordinary DOM
							  text, and this app sets no `maskTextSelector`, so an unmarked
							  block renders the live key straight into any recording.
							*/}
							<div
								aria-labelledby={labelId}
								className="ph-no-capture text-muted-foreground bg-muted flex-1 rounded-md border p-3 font-mono text-sm break-all"
							>
								{apiKey.plaintext}
							</div>
							{/*
							  The label carries the state, because the icon is the only
							  other thing that reports it and an icon is not announced. It
							  is also what makes the checkmark testable: with a constant
							  label, `flashCopied` could be deleted outright and every test
							  in the spec would still pass.
							*/}
							<Button
								type="button"
								variant={flashCopied ? 'default' : 'outline'}
								size="icon"
								aria-label={flashCopied ? 'API key copied' : 'Copy API key'}
								className="shrink-0"
								onClick={handleCopy}
							>
								{flashCopied ? (
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
						{apiKey.expiresAt && (
							<p className="text-muted-foreground text-xs">
								This key stops working on{' '}
								{new Date(apiKey.expiresAt).toLocaleDateString()}
							</p>
						)}
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
