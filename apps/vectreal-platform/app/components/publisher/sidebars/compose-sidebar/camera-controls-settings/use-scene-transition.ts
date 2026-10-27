import { useAtom } from 'jotai/react'
import { useCallback, useMemo } from 'react'

import {
	normalizeCameraState,
	normalizeTransition,
	withDefaultCameraFlag
} from './camera-state'
import { cameraAtom } from '../../../../../lib/stores/scene-settings-store'

import type {
	CameraTransitionConfig,
	CameraTransitionEasing,
	CameraTransitionType
} from '@vctrl/core'

/**
 * The scene-wide camera transition and its edits. It is read normalized, so
 * every edit is the current transition with one field changed.
 */
export function useSceneTransition() {
	const [camera, setCamera] = useAtom(cameraAtom)
	const transition = useMemo(
		() => normalizeTransition(camera.sceneTransition),
		[camera.sceneTransition]
	)

	const write = useCallback(
		(next: CameraTransitionConfig) => {
			setCamera((prev) =>
				withDefaultCameraFlag({
					...normalizeCameraState(prev),
					sceneTransition: next
				})
			)
		},
		[setCamera]
	)

	/** Keeps the timing the new type can use, and defaults the rest. */
	const setType = useCallback(
		(type: CameraTransitionType) => {
			write(normalizeTransition({ ...transition, type }))
		},
		[transition, write]
	)

	const setDuration = useCallback(
		(duration: number) => {
			write({ ...transition, duration: Math.max(0, duration) })
		},
		[transition, write]
	)

	const setEasing = useCallback(
		(easing: CameraTransitionEasing) => {
			if (transition.type === 'none') return
			write({ ...transition, easing })
		},
		[transition, write]
	)

	return { transition, setType, setDuration, setEasing }
}
