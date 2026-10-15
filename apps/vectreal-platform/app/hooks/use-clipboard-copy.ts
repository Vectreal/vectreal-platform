import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

const CONFIRMATION_MS = 1500

export interface ClipboardCopyApi {
	copy: (
		id: string,
		value: string | (() => string | Promise<string>),
		messages: { success: string; failure: string; unavailable: string }
	) => Promise<void>
	/** Id of the button that most recently copied, for its "Copied" label. */
	copiedId: string | null
}

/*
  A value still being fetched goes through `ClipboardItem`, which accepts a
  promise. Safari forgets the click once an `await` has passed, so fetching first
  and calling `writeText` afterwards is refused there as a write nobody asked
  for. Where `ClipboardItem` is missing, the fetch is awaited and `writeText`
  tried anyway: the browsers lacking it do not hold that rule.
*/
async function writeToClipboard(value: string | Promise<string>) {
	if (typeof value === 'string') {
		await navigator.clipboard.writeText(value)
	} else if (typeof ClipboardItem !== 'undefined') {
		await navigator.clipboard.write([
			new ClipboardItem({
				'text/plain': value.then(
					(text) => new Blob([text], { type: 'text/plain' })
				)
			})
		])
	} else {
		await navigator.clipboard.writeText(await value)
	}
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
			value: string | (() => string | Promise<string>),
			messages: { success: string; failure: string; unavailable: string }
		) => {
			if (!navigator?.clipboard) {
				toast.error(messages.unavailable)
				return
			}

			try {
				// Resolved only now, so nothing is fetched for a clipboard that is not there.
				await writeToClipboard(typeof value === 'function' ? value() : value)
				setCopiedId(id)
				if (timeoutRef.current) clearTimeout(timeoutRef.current)
				timeoutRef.current = setTimeout(
					() => setCopiedId(null),
					CONFIRMATION_MS
				)
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
