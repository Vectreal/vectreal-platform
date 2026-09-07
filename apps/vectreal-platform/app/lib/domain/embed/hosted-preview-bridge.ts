import {
	HOSTED_PREVIEW_VIEWER_SOURCE,
	isHostedPreviewIncomingMessage,
	type EmbedCameraDescriptor,
	type EmbedHotspotDescriptor,
	type HostedPreviewOutgoingMessage
} from '@vctrl/embed'
import { resolveHotspotMarkers } from '@vctrl/viewer/hotspots'
import { useCallback, useEffect, useRef } from 'react'

import type {
	CameraConfig,
	CameraProps,
	HotspotDefinition,
	SceneInteractionDefinition
} from '@vctrl/core'
import type {
	VectrealViewerProps,
	ViewerCommandExecutor,
	ViewerInteractionEvent
} from '@vctrl/viewer'

interface UseHostedPreviewBridgeParams {
	sceneId?: string
	interactions?: SceneInteractionDefinition[]
	cameras?: CameraProps['cameras']
	hotspots?: HotspotDefinition[]
	/** Commands to execute once on viewer_ready (e.g. from URL params). */
	initialCommands?: import('@vctrl/viewer').ViewerCommand[]
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

function buildCameraDescriptors(
	cameras?: CameraProps['cameras']
): EmbedCameraDescriptor[] {
	if (!cameras?.length) return []
	return cameras.map((c: CameraConfig) => ({
		id: c.cameraId ?? '',
		name: c.name ?? c.cameraId ?? '',
		fov: c.fov
	}))
}

/**
 * The hotspots a host page is allowed to hear about.
 *
 * Built through `resolveHotspotMarkers` with its default options, which is the
 * same filter the renderer uses, so `internalOnly` and hidden markers cannot
 * reach a parent page. That is not belt and braces here. `redactSettingsForEmbed`
 * runs in exactly one place, `buildEmbedSceneManifest`, and `/preview` never
 * reaches it - it always takes the session branch - so the settings this hook
 * is handed there are unredacted, and this filter is the only thing standing
 * between an internal marker's name and whichever origin pinged the frame.
 *
 * Names and camera ids only. A host builds navigation from these; the body and
 * the link are what the viewer draws, and a second copy on the page would have
 * nothing keeping it in step.
 */
export function buildHotspotDescriptors(
	hotspots?: HotspotDefinition[]
): EmbedHotspotDescriptor[] {
	return resolveHotspotMarkers(hotspots).map((marker) => ({
		id: marker.id,
		name: marker.name,
		cameraId: marker.linkedCameraId,
		step: marker.step
	}))
}

export function useHostedPreviewBridge({
	sceneId,
	interactions,
	cameras,
	hotspots,
	initialCommands
}: UseHostedPreviewBridgeParams): HostedPreviewBridgeProps {
	const executorRef = useRef<null | ViewerCommandExecutor>(null)
	const parentOriginRef = useRef<null | string>(null)
	const outboundQueueRef = useRef<HostedPreviewOutgoingMessage[]>([])
	const sortedInteractionsRef = useRef(getSortedInteractions(interactions))
	const activeScrollInteractionIdsRef = useRef(new Set<string>())
	const firedViewerReadyInteractionIdsRef = useRef(new Set<string>())
	const lastScrollProgressRef = useRef<null | number>(null)
	const camerasRef = useRef(cameras)
	const hotspotsRef = useRef(hotspots)
	const initialCommandsFiredRef = useRef(false)

	useEffect(() => {
		camerasRef.current = cameras
	}, [cameras])

	useEffect(() => {
		hotspotsRef.current = hotspots
	}, [hotspots])

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

			// If we don't know the parent origin yet, queue for when it's established.
			if (!parentOriginRef.current) {
				outboundQueueRef.current.push(message)
				return
			}

			window.parent.postMessage(message, parentOriginRef.current)
		},
		[]
	)

	const flushOutboundQueue = useCallback((origin: string) => {
		if (!outboundQueueRef.current.length) return
		for (const message of outboundQueueRef.current) {
			window.parent.postMessage(message, origin)
		}
		outboundQueueRef.current = []
	}, [])

	const sendPong = useCallback(
		(replyOrigin: string) => {
			const pong: HostedPreviewOutgoingMessage = {
				source: HOSTED_PREVIEW_VIEWER_SOURCE,
				type: 'pong',
				sceneId,
				cameras: buildCameraDescriptors(camerasRef.current),
				hotspots: buildHotspotDescriptors(hotspotsRef.current)
			}
			window.parent.postMessage(pong, replyOrigin)
		},
		[sceneId]
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

			// Apply URL param initial commands once, before interaction sweep.
			if (!initialCommandsFiredRef.current && initialCommands?.length) {
				initialCommandsFiredRef.current = true
				for (const command of initialCommands) {
					executorRef.current?.execute(command)
				}
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
			// Establish (or confirm) trusted parent origin from the first valid message.
			if (event.origin && event.origin !== 'null') {
				if (!parentOriginRef.current) {
					parentOriginRef.current = event.origin
					flushOutboundQueue(event.origin)
				}
			}

			if (!isHostedPreviewIncomingMessage(event.data)) {
				return
			}

			switch (event.data.type) {
				case 'ping':
					// Reply immediately with pong so VectrealEmbed.ready() can resolve.
					if (parentOriginRef.current) {
						sendPong(parentOriginRef.current)
					}
					break
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
	}, [applyHostMessage, applyScrollProgress, flushOutboundQueue, sendPong])

	return {
		onCommandExecutorReady,
		onInteractionEvent
	}
}
