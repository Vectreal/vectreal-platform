import { Button } from '@shared/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle
} from '@shared/components/ui/dialog'
import { CheckCircle2, Copy } from 'lucide-react'
import { useId, type FC } from 'react'

import { useClipboardCopy } from '../../hooks/use-clipboard-copy'

/**
 * The moment a freshly minted key is put in front of its owner.
 *
 * It makes no claim about secrecy, and there is no warning to dismiss. The
 * embed token is public by construction - `buildEmbedUrl` puts it in an
 * `iframe src` on the customer's own page - and it is stored decryptably, so
 * the API keys list and the embed panel both show it back on demand. This
 * dialog is a confirmation that the key exists and an offer to copy it, not a
 * last chance.
 *
 * It used to be exactly that last chance: an amber alert, a "copy it now"
 * instruction, and a `window.confirm` on dismissal asking whether the key had
 * been copied, with Escape disabled so the question could not be skipped. Every
 * one of those was protecting a value the next screen hands over anyway, and
 * warning someone about a loss that cannot happen teaches them to click through
 * the next warning that is real.
 *
 * Creation and rotation share it because they differ only in what has to happen
 * next - and after a rotation that difference is the whole point: every embed
 * still carrying the previous secret is broken until it is updated. That is the
 * one warning here, and it is about breakage rather than disclosure.
 *
 * The copy lives here rather than in `lib/domain/embed/embed-snippet.ts`. That
 * module describes the embed snippet, and a dialog the dashboard also opens
 * could not read from it without the dashboard depending on the embed domain.
 */

export type OneTimeKeyReason = 'created' | 'rotated'

export interface OneTimeKeyValue {
	plaintext: string
	name: string
	/**
	 * Whether this key was stored in a form the API keys page can read back.
	 *
	 * Not a formality. `embed-token-cipher.server.ts` is built to tolerate an
	 * unset `EMBED_TOKEN_ENCRYPTION_KEY` rather than fail every mint, so on a
	 * deployment that never configured it `createApiKey` writes a null
	 * ciphertext and the value genuinely cannot be shown again. Promising recall
	 * there would lose someone a working key, which is the one loss the warning
	 * this dialog used to carry was actually protecting against.
	 */
	recoverable: boolean
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

const COPY_MESSAGES = {
	success: 'API key copied to clipboard',
	failure: 'Failed to copy the API key.',
	unavailable: 'Clipboard is not available in this browser.'
}

/**
 * The one sentence that changes with `recoverable`, and the step that goes with
 * it. Everything else this dialog says is true either way.
 */
const RECALL_COPY = {
	recoverable: {
		description: 'You can see it again on the API keys page.',
		step: null
	},
	unrecoverable: {
		description: 'Copy it now - this key cannot be shown again.',
		step: 'Copy the key above to a secure location'
	}
} as const

const REASON_COPY: Record<
	OneTimeKeyReason,
	{ title: string; description: string; nextSteps: string[] }
> = {
	created: {
		title: 'API key created',
		description: 'Ready to paste into an embed.',
		nextSteps: [
			'Paste it into the embed snippet, or into your own request headers',
			'Add the site that will host the embed to the allowed domains for this project'
		]
	},
	rotated: {
		title: 'API key rotated',
		description:
			'The previous key stopped working the moment this one was issued.',
		nextSteps: [
			'Replace the old key everywhere it is already deployed - every embed still carrying it is refused right now',
			'The Last Used column stays empty until something authenticates with the new key, which is how you confirm the update landed'
		]
	}
}

export const OneTimeKeyDialog: FC<{
	open: boolean
	onClose: () => void
	apiKey: OneTimeKeyValue | null
	reason: OneTimeKeyReason
}> = ({ open, onClose, apiKey, reason }) => {
	const labelId = useId()
	const { copy, copiedId } = useClipboardCopy()
	const content = REASON_COPY[reason]

	if (!apiKey) return null

	/*
	  Keyed on the plaintext, which is what makes a per-key reset unnecessary.
	  This component is never remounted between keys - the parent renders it
	  continuously and only swaps `apiKey` - so a `copiedId` keyed on anything
	  constant would carry the checkmark into the next key's dialog. Rotating
	  twice in quick succession is two clicks and a round trip.

	  Not the preview: four characters, and two keys sharing them would re-arm
	  the checkmark for a value that was never copied.
	*/
	const copied = copiedId === apiKey.plaintext
	const recall =
		RECALL_COPY[apiKey.recoverable ? 'recoverable' : 'unrecoverable']
	const nextSteps = recall.step
		? [recall.step, ...content.nextSteps]
		: content.nextSteps

	return (
		<Dialog open={open} onOpenChange={(next) => !next && onClose()}>
			<DialogContent className="max-w-2xl">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<CheckCircle2 className="text-success size-5" />
						{content.title}
					</DialogTitle>
					<DialogDescription>
						{content.description} {recall.description}
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					<div className="space-y-2">
						<p className="text-h4" id={labelId}>
							{apiKey.name}
						</p>
						<div className="flex gap-2">
							{/*
							  `ph-no-capture` keeps the key out of PostHog session replay.
							  `entry.client.tsx` returns `$snapshot` events from
							  `before_send` unmodified, so replay applies no redaction of
							  its own and this class is the only thing between a live key
							  and a recording.
							*/}
							<div
								aria-labelledby={labelId}
								className="ph-no-capture text-muted-foreground bg-muted flex-1 rounded-xl border p-3 font-mono text-sm break-all"
							>
								{apiKey.plaintext}
							</div>
							{/*
							  The label carries the state, because the icon is the only
							  other thing that reports it and an icon is not announced. It
							  is also what makes the checkmark testable: with a constant
							  label the copied state could be deleted outright and every
							  test in the spec would still pass.
							*/}
							<Button
								type="button"
								variant={copied ? 'default' : 'outline'}
								size="icon"
								aria-label={copied ? 'API key copied' : 'Copy API key'}
								className="shrink-0"
								onClick={() =>
									void copy(apiKey.plaintext, apiKey.plaintext, COPY_MESSAGES)
								}
							>
								{copied ? (
									<CheckCircle2 className="size-4" />
								) : (
									<Copy className="size-4" />
								)}
							</Button>
						</div>
						{apiKey.expiresAt && (
							<p className="text-muted-foreground text-xs">
								This key stops working on{' '}
								{new Date(apiKey.expiresAt).toLocaleDateString()}
							</p>
						)}
					</div>

					<div className="bg-muted space-y-2 rounded-xl p-4">
						<h4 className="text-h4">Next steps</h4>
						<ul className="text-muted-foreground list-inside list-disc space-y-1 text-sm">
							{nextSteps.map((step) => (
								<li key={step}>{step}</li>
							))}
						</ul>
					</div>
				</div>

				<DialogFooter>
					{/*
					  "Done", not "Close": `DialogContent` renders its own close control
					  with an sr-only "Close" label, and two buttons answering to the
					  same name is ambiguous to a screen reader reading the dialog and
					  to anything querying it by role.
					*/}
					<Button onClick={onClose} className="w-full">
						Done
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
