import { useCallback, useEffect, useState } from 'react'

export interface UseChromeVisibilityParams {
	/** Invoked on Escape. The chrome's Back control calls the same thing. */
	onExit: () => void
}

export interface ChromeVisibility {
	isVisible: boolean
	show: () => void
	hide: () => void
	toggle: () => void
}

/**
 * Typing an `h` into a field should not blank the screen, and a keystroke aimed
 * at an open camera dropdown belongs to that dropdown.
 */
export function isEditableEventTarget(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) {
		return false
	}

	if (target.isContentEditable) {
		return true
	}

	const tagName = target.tagName
	if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') {
		return true
	}

	// Radix Select renders a button with listbox semantics rather than a <select>.
	return Boolean(target.closest('[role="listbox"], [role="combobox"]'))
}

/**
 * What a keydown means to the chrome, separated from the listener so the
 * decision can be tested without a DOM.
 */
export function resolveChromeKeyAction(
	event: Pick<KeyboardEvent, 'key' | 'altKey' | 'ctrlKey' | 'metaKey'>
): 'exit' | 'toggle' | null {
	if (event.altKey || event.ctrlKey || event.metaKey) {
		return null
	}

	if (event.key === 'Escape') {
		return 'exit'
	}

	return event.key === 'h' || event.key === 'H' ? 'toggle' : null
}

/**
 * Chrome starts visible and only hides when asked.
 *
 * No auto-hide-on-idle: the scene is the point, but a control that vanishes on
 * its own leaves people hunting for it. `H` toggles, `Esc` leaves. Hidden state
 * still leaves a restore affordance on screen, so this is never a dead end.
 */
export function useChromeVisibility({
	onExit
}: UseChromeVisibilityParams): ChromeVisibility {
	const [isVisible, setIsVisible] = useState(true)

	const show = useCallback(() => setIsVisible(true), [])
	const hide = useCallback(() => setIsVisible(false), [])
	const toggle = useCallback(() => setIsVisible((current) => !current), [])

	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (isEditableEventTarget(event.target)) {
				return
			}

			const action = resolveChromeKeyAction(event)
			if (!action) {
				return
			}

			event.preventDefault()
			if (action === 'exit') {
				onExit()
				return
			}

			toggle()
		}

		window.addEventListener('keydown', handleKeyDown)
		return () => window.removeEventListener('keydown', handleKeyDown)
	}, [onExit, toggle])

	return { isVisible, show, hide, toggle }
}
