import { useEffect, useState } from 'react'

import type { InteractionInput } from '../components/interaction-help'

/** How long the hint stays when nobody touches the scene. */
export const INTERACTION_HINT_MS = 5000

const COARSE_POINTER = '(pointer: coarse)'

/** Touch on a coarse pointer, else a mouse. */
export const pointerInput = (): InteractionInput =>
	typeof window !== 'undefined' &&
	typeof window.matchMedia === 'function' &&
	window.matchMedia(COARSE_POINTER).matches
		? 'touch'
		: 'mouse'

/**
 * Whether the first-time hint is on screen, and for which input.
 *
 * Shown once per viewer, from the moment `ready` turns true, and gone for good
 * on the first press, scroll or key inside the viewer or after
 * `INTERACTION_HINT_MS`. Worded for touch on a coarse pointer and for a mouse
 * otherwise, and for keys once the viewer is reached from the keyboard.
 *
 * Held here, in the viewer, rather than in the hint: the overlay that draws it
 * is torn down while the canvas is lost, and a hint that remounted would show
 * twice in one page view.
 */
export function useInteractionHint({
	enabled,
	ready,
	container
}: {
	enabled: boolean
	ready: boolean
	container: HTMLElement | null
}): { visible: boolean; input: InteractionInput } {
	const [input, setInput] = useState<InteractionInput>('mouse')
	const [phase, setPhase] = useState<'waiting' | 'shown' | 'done'>('waiting')

	useEffect(() => {
		if (phase === 'waiting' && enabled && ready) {
			setInput(pointerInput())
			setPhase('shown')
		} else if (phase === 'shown' && !enabled) {
			// Withdrawn by the host: gone, not paused.
			setPhase('done')
		}
	}, [enabled, phase, ready])

	useEffect(() => {
		if (phase !== 'shown' || !container) return
		const dismiss = () => setPhase('done')
		const timer = setTimeout(dismiss, INTERACTION_HINT_MS)
		const handleFocus = () => {
			if (container.matches(':focus-visible')) setInput('keys')
		}
		container.addEventListener('pointerdown', dismiss)
		container.addEventListener('wheel', dismiss, { passive: true })
		container.addEventListener('keydown', dismiss)
		container.addEventListener('focus', handleFocus)
		return () => {
			clearTimeout(timer)
			container.removeEventListener('pointerdown', dismiss)
			container.removeEventListener('wheel', dismiss)
			container.removeEventListener('keydown', dismiss)
			container.removeEventListener('focus', handleFocus)
		}
	}, [container, phase])

	return { visible: phase === 'shown' && enabled, input }
}
