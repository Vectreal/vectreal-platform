import { Button } from '@shared/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle
} from '@shared/components/ui/dialog'
import { Check, Copy } from 'lucide-react'
import { useState, type FC } from 'react'
import { toast } from 'sonner'

import { EMBED_COPY } from '../../lib/domain/embed/embed-snippet'

interface EmbedCreatedKeyDialogProps {
	plaintext: string | null
	onDismiss: () => void
}

/**
 * The one and only view of a freshly minted key.
 *
 * A modal rather than a notice inside the panel, because the panel is not a
 * stable place to put a secret that cannot be re-read. In the publisher it
 * lives inside a `type="single"` accordion: opening any other section
 * unmounts it, taking the key with it. The user would not have "left the
 * page" - they would have clicked a heading - and the key would be gone for
 * good. A modal blocks the accordion underneath until it is dismissed.
 *
 * `api-keys-new.tsx` has its own version of this for the same event. The two
 * differ in what they tell the user to do next, which is why this is not that
 * one lifted out; the shared shell is worth extracting once a third appears.
 */
export const EmbedCreatedKeyDialog: FC<EmbedCreatedKeyDialogProps> = ({
	plaintext,
	onDismiss
}) => {
	const [copied, setCopied] = useState(false)

	const handleCopy = async () => {
		if (!plaintext || !navigator?.clipboard) {
			toast.error(EMBED_COPY.clipboardUnavailable)
			return
		}

		try {
			await navigator.clipboard.writeText(plaintext)
			setCopied(true)
			toast.success(EMBED_COPY.copyKeySuccess)
		} catch (error) {
			console.error('Failed to copy the API key:', error)
			toast.error(EMBED_COPY.copyKeyFailure)
		}
	}

	const handleDismiss = () => {
		if (
			!copied &&
			!window.confirm(EMBED_COPY.createKeyDismissWithoutCopyConfirm)
		) {
			return
		}

		setCopied(false)
		onDismiss()
	}

	return (
		<Dialog
			open={plaintext !== null}
			onOpenChange={(open) => !open && handleDismiss()}
		>
			{/* Escape is disabled so the one dismissal path runs the copy check. */}
			<DialogContent onEscapeKeyDown={(event) => event.preventDefault()}>
				<DialogHeader>
					<DialogTitle>{EMBED_COPY.createKeyDialogTitle}</DialogTitle>
					<DialogDescription>{EMBED_COPY.createKeyOnce}</DialogDescription>
				</DialogHeader>

				{/*
				  `ph-no-capture` keeps the key out of PostHog session replay. Replay
				  masks input values by default but not ordinary DOM text, and this
				  app sets no `maskTextSelector`, so an unmarked block renders the
				  live key straight into any recording.
				*/}
				<div className="ph-no-capture bg-muted rounded-xl p-3 font-mono text-xs break-all">
					{plaintext}
				</div>

				<DialogFooter className="gap-2 sm:justify-between">
					<Button variant="secondary" onClick={handleCopy}>
						{copied ? (
							<Check className="mr-1 h-3.5 w-3.5" />
						) : (
							<Copy className="mr-1 h-3.5 w-3.5" />
						)}
						{copied ? EMBED_COPY.copied : EMBED_COPY.copyKey}
					</Button>
					<Button onClick={handleDismiss}>
						{EMBED_COPY.createKeyDialogDismiss}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
