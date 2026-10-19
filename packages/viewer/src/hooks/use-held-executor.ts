import { useCallback, useMemo, useRef } from 'react'

import type { ViewerCommand } from '../types/viewer-interactions'

export interface HeldExecutor<
	Command extends { type: string } = ViewerCommand
> {
	execute: (command: Command) => void
	register: (executor: null | { execute: (command: Command) => void }) => void
}

/**
 * A slot for one scene layer's executor that never drops a command.
 *
 * The camera, hotspot and animation layers live inside the canvas, which is
 * not mounted while the scene loads or while the viewer sits out of view, and
 * the camera layer registers only once its initial framing is done. A command
 * arriving in those gaps used to go to a null executor and vanish: an embed
 * SDK call made on page load, a URL `?camera`, a click in the embed chrome.
 *
 * So the slot holds what it cannot run and replays it the moment the layer
 * registers. Only the latest command of each type is kept, in the order they
 * were last sent: a camera asked for three times while off screen should fly
 * once, to the last one.
 */
export function useHeldExecutor<
	Command extends { type: string } = ViewerCommand
>(): HeldExecutor<Command> {
	const executorRef = useRef<null | { execute: (command: Command) => void }>(
		null
	)
	const heldRef = useRef(new Map<Command['type'], Command>())

	const register = useCallback(
		(executor: null | { execute: (command: Command) => void }) => {
			executorRef.current = executor
			if (!executor) return

			const held = [...heldRef.current.values()]
			heldRef.current.clear()
			for (const command of held) executor.execute(command)
		},
		[]
	)

	const execute = useCallback((command: Command) => {
		if (executorRef.current) {
			executorRef.current.execute(command)
			return
		}
		heldRef.current.delete(command.type)
		heldRef.current.set(command.type, command)
	}, [])

	return useMemo(() => ({ register, execute }), [register, execute])
}
