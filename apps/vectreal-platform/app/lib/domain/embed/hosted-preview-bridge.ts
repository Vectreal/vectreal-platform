import { useCallback, useEffect, useRef } from 'react'

import {
	HOSTED_PREVIEW_VIEWER_SOURCE,
	type HostedPreviewOutgoingMessage,
	isHostedPreviewIncomingMessage
} from './hosted-preview-protocol'

import type { SceneInteractionDefinition } from '@vctrl/core'
import type {
	VectrealViewerProps,
	ViewerCommandExecutor,
	ViewerInteractionEvent
} from '@vctrl/viewer'

interface UseHostedPreviewBridgeParams {
	sceneId?: string
	interactions?: SceneInteractionDefinition[]
}

export type HostedPreviewBridgeProps = Pick<
	VectrealViewerProps,
	'onCommandExecutorReady' | 'onInteractionEvent'
>

function getInteractionKey(
	interaction: SceneInteractionDefinition,
	index: number
) {
	return interaction.id || `interaction-${interaction.order ?? index + 1}`
}

function getParentOriginFromReferrer(): null | string {
	if (typeof document === 'undefined' || !document.referrer) {
		return null
	}

	try {
		return new URL(document.referrer).origin
	} catch {
		return null
	}
}

function getSortedInteractions(
	interactions?: SceneInteractionDefinition[]
): SceneInteractionDefinition[] {
	if (!interactions?.length) {
		return []
	}

	return [...interactions]
		.filter((interaction) => interaction.enabled !== false)
		.sort((left, right) => (left.order ?? 0) - (right.order ?? 0))
}

export function useHostedPreviewBridge({
	sceneId,
	interactions
}: UseHostedPreviewBridgeParams): HostedPreviewBridgeProps {
	const executorRef = useRef<null | ViewerCommandExecutor>(null)
	const parentOriginRef = useRef<null | string>(null)
	const sortedInteractionsRef = useRef(getSortedInteractions(interactions))
	const activeScrollInteractionIdsRef = useRef(new Set<string>())
	const firedViewerReadyInteractionIdsRef = useRef(new Set<string>())
	const lastScrollProgressRef = useRef<null | number>(null)

	useEffect(() => {
		sortedInteractionsRef.current = getSortedInteractions(interactions)
		activeScrollInteractionIdsRef.current.clear()
		firedViewerReadyInteractionIdsRef.current.clear()
	}, [interactions])

	const postMessageToParent = useCallback(
		(message: HostedPreviewOutgoingMessage) => {
			if (typeof window === 'undefined' || !window.parent) {
				return
			}

			const targetOrigin =
				parentOriginRef.current || getParentOriginFromReferrer() || '*'

			window.parent.postMessage(message, targetOrigin)
		},
		[]
	)

	const executeInteraction = useCallback(
		(interaction: SceneInteractionDefinition, index: number) => {
			const interactionId = getInteractionKey(interaction, index)

			for (const action of interaction.actions) {
				switch (action.type) {
					case 'activate_camera':
						executorRef.current?.execute({
							type: 'activate_camera',
							cameraId: action.cameraId
						})
						break
					case 'emit_custom_event':
						postMessageToParent({
							source: HOSTED_PREVIEW_VIEWER_SOURCE,
							type: 'interaction_event',
							sceneId,
							interactionId,
							eventName: action.eventName,
							payload: action.payload
						})
						break
					case 'set_controls_enabled':
						executorRef.current?.execute({
							type: 'set_controls_enabled',
							enabled: action.enabled
						})
						break
				}
			}
		},
		[postMessageToParent, sceneId]
	)

	const applyScrollProgress = useCallback(
		(progress: number) => {
			lastScrollProgressRef.current = progress

			sortedInteractionsRef.current.forEach((interaction, index) => {
				if (interaction.trigger.type !== 'host_scroll_progress') {
					return
				}

				const interactionId = getInteractionKey(interaction, index)
				const isInRange =
					progress >= interaction.trigger.start &&
					progress <= interaction.trigger.end

				if (!isInRange) {
					activeScrollInteractionIdsRef.current.delete(interactionId)
					return
				}

				if (activeScrollInteractionIdsRef.current.has(interactionId)) {
					return
				}

				activeScrollInteractionIdsRef.current.add(interactionId)
				executeInteraction(interaction, index)
			})
		},
		[executeInteraction]
	)

	const applyHostMessage = useCallback(
		(message: string) => {
			sortedInteractionsRef.current.forEach((interaction, index) => {
				if (interaction.trigger.type !== 'host_message') {
					return
				}

				if (interaction.trigger.message !== message) {
					return
				}

				executeInteraction(interaction, index)
			})
		},
		[executeInteraction]
	)

	const onInteractionEvent = useCallback(
		(event: ViewerInteractionEvent) => {
			postMessageToParent({
				source: HOSTED_PREVIEW_VIEWER_SOURCE,
				type: 'viewer_event',
				sceneId,
				event
			})

			if (event.type !== 'viewer_ready') {
				return
			}

			sortedInteractionsRef.current.forEach((interaction, index) => {
				if (interaction.trigger.type !== 'viewer_ready') {
					return
				}

				const interactionId = getInteractionKey(interaction, index)
				if (firedViewerReadyInteractionIdsRef.current.has(interactionId)) {
					return
				}

				firedViewerReadyInteractionIdsRef.current.add(interactionId)
				executeInteraction(interaction, index)
			})

			activeScrollInteractionIdsRef.current.clear()

			if (lastScrollProgressRef.current !== null) {
				applyScrollProgress(lastScrollProgressRef.current)
			}
		},
		[applyScrollProgress, executeInteraction, postMessageToParent, sceneId]
	)

	const onCommandExecutorReady = useCallback(
		(executor: null | ViewerCommandExecutor) => {
			executorRef.current = executor

			if (!executor) {
				activeScrollInteractionIdsRef.current.clear()
			}
		},
		[]
	)

	useEffect(() => {
		if (typeof window === 'undefined') {
			return
		}

		const handleMessage = (event: MessageEvent<unknown>) => {
			if (event.origin) {
				parentOriginRef.current = event.origin
			}

			if (!isHostedPreviewIncomingMessage(event.data)) {
				return
			}

			switch (event.data.type) {
				case 'viewer_command':
					executorRef.current?.execute(event.data.command)
					break
				case 'host_scroll_progress':
					applyScrollProgress(event.data.progress)
					break
				case 'host_message':
					applyHostMessage(event.data.message)
					break
			}
		}

		window.addEventListener('message', handleMessage)

		return () => {
			window.removeEventListener('message', handleMessage)
		}
	}, [applyHostMessage, applyScrollProgress])

	return {
		onCommandExecutorReady,
		onInteractionEvent
	}
}
