import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

const CONFIRMATION_MS = 1500

export interface ClipboardCopyApi {
	copy: (
		id: string,
		value: string,
		messages: { success: string; failure: string; unavailable: string }
	) => Promise<void>
	/** Id of the button that most recently copied, for its "Copied" label. */
	copiedId: string | null
}

/**
 * Copy-to-clipboard with a short per-button confirmation.
 *
 * One `copiedId` rather than a boolean per button: the embed panel has six copy
 * affordances, and each one carrying its own `useState` plus `setTimeout` was
 * how the three that existed before drifted into three slightly different
 * versions of the same handler.
 */
export function useClipboardCopy(): ClipboardCopyApi {
	const [copiedId, setCopiedId] = useState<string | null>(null)
	const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

	useEffect(
		() => () => {
			if (timeoutRef.current) clearTimeout(timeoutRef.current)
		},
		[]
	)

	const copy = useCallback(
		async (
			id: string,
			value: string,
			messages: { success: string; failure: string; unavailable: string }
		) => {
			if (!navigator?.clipboard) {
				toast.error(messages.unavailable)
				return
			}

			try {
				await navigator.clipboard.writeText(value)
				setCopiedId(id)
				if (timeoutRef.current) clearTimeout(timeoutRef.current)
				timeoutRef.current = setTimeout(() => setCopiedId(null), CONFIRMATION_MS)
				toast.success(messages.success)
			} catch (error) {
				console.error('Failed to copy to clipboard:', error)
				toast.error(messages.failure)
			}
		},
		[]
	)

	return { copy, copiedId }
}
