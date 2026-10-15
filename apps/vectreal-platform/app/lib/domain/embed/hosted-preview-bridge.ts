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
 * runs only on the published manifest, and `/preview` of a draft is served the
 * working scene - so the settings this hook is handed there are unredacted, and
 * this filter is the only thing standing between an internal marker's name and
 * whichever origin pinged the frame.
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
	/*
	  Whether the viewer accepts commands, which is what a pong tells the SDK:
	  it marks itself ready on the pong and flushes every command it queued.
	  The pong used to go out as soon as this listener existed, while the scene
	  was still loading, so those commands reached no viewer and were dropped.
	*/
	const acceptsCommandsRef = useRef(false)
	// Whether the canvas has mounted once since the viewer registered.
	const cameraLayerMountedRef = useRef(false)

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
			// Top-level, as /preview is, there is no page to tell.
			if (typeof window === 'undefined' || window.parent === window) {
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

	/*
	  Readiness goes straight to a known parent, never through the outbound
	  queue: a queued `viewer_ready` could be flushed after the viewer that
	  sent it had gone, and the SDK would flush its commands into nothing.
	  The pong goes first, so the SDK has the scene's cameras and hotspots
	  before `viewer_ready` resolves its `ready()`. Every pinging SDK gets
	  both, since a `ready()` already waiting resolves only on the second;
	  the SDK ignores a `viewer_ready` it has already had.
	*/
	const announceReady = useCallback(
		(replyOrigin: string) => {
			sendPong(replyOrigin)
			window.parent.postMessage(
				{
					source: HOSTED_PREVIEW_VIEWER_SOURCE,
					type: 'viewer_event',
					sceneId,
					event: { type: 'viewer_ready' }
				} satisfies HostedPreviewOutgoingMessage,
				replyOrigin
			)
		},
		[sceneId, sendPong]
	)

	const onInteractionEvent = useCallback(
		(event: ViewerInteractionEvent) => {
			/*
			  The viewer emits `viewer_ready` each time its camera layer comes
			  up, which waits for the frame to come near the viewport. The page
			  hears readiness from `onCommandExecutorReady` instead.
			*/
			if (event.type !== 'viewer_ready') {
				postMessageToParent({
					source: HOSTED_PREVIEW_VIEWER_SOURCE,
					type: 'viewer_event',
					sceneId,
					event
				})
				return
			}

			// The first mount already ran everything the page sent, in order.
			// A remount resets the camera, so the scroll position is applied
			// again to put it back.
			if (!cameraLayerMountedRef.current) {
				cameraLayerMountedRef.current = true
				return
			}

			activeScrollInteractionIdsRef.current.clear()

			if (lastScrollProgressRef.current !== null) {
				applyScrollProgress(lastScrollProgressRef.current)
			}
		},
		[applyScrollProgress, postMessageToParent, sceneId]
	)

	const onCommandExecutorReady = useCallback(
		(executor: null | ViewerCommandExecutor) => {
			executorRef.current = executor
			acceptsCommandsRef.current = executor !== null

			if (!executor) {
				activeScrollInteractionIdsRef.current.clear()
				return
			}
			cameraLayerMountedRef.current = false

			/*
			  The viewer holds a command its scene cannot run yet and runs it
			  once it can, keeping the latest of each kind. So the author's
			  defaults go in now, before the page is told it may send its own:
			  a camera the page asks for then replaces them rather than being
			  replaced by them.
			*/
			if (!initialCommandsFiredRef.current && initialCommands?.length) {
				initialCommandsFiredRef.current = true
				for (const command of initialCommands) executor.execute(command)
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

			// A scroll position the page sent while the scene loaded found no
			// viewer to run it.
			activeScrollInteractionIdsRef.current.clear()
			if (lastScrollProgressRef.current !== null) {
				applyScrollProgress(lastScrollProgressRef.current)
			}

			if (parentOriginRef.current) announceReady(parentOriginRef.current)
		},
		[announceReady, applyScrollProgress, executeInteraction, initialCommands]
	)

	useEffect(() => {
		if (typeof window === 'undefined') {
			return
		}

		const handleMessage = (event: MessageEvent<unknown>) => {
			/*
			  Only the page embedding this frame may drive it. Other frames and
			  windows can post here too, and an origin does not tell them apart
			  from the parent, so the sender is compared first. The origin is
			  then pinned from the parent's first protocol message, never from
			  noise, because it is where every reply goes: the scene's cameras,
			  hotspots and events. A parent whose origin is opaque (`'null'`,
			  e.g. a sandboxed or file:// page) can still drive the viewer but
			  cannot be replied to.
			*/
			if (event.source !== window.parent) return
			if (!isHostedPreviewIncomingMessage(event.data)) return

			const pinsOrigin =
				!parentOriginRef.current && !!event.origin && event.origin !== 'null'
			if (pinsOrigin) parentOriginRef.current = event.origin

			switch (event.data.type) {
				case 'ping':
					// Unanswered until the viewer accepts commands; the SDK pings again.
					if (acceptsCommandsRef.current && parentOriginRef.current) {
						announceReady(parentOriginRef.current)
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

			// After the reply, so queued events reach a page that knows the scene.
			if (pinsOrigin) flushOutboundQueue(event.origin)
		}

		window.addEventListener('message', handleMessage)

		return () => {
			window.removeEventListener('message', handleMessage)
		}
	}, [applyHostMessage, applyScrollProgress, announceReady, flushOutboundQueue])

	return {
		onCommandExecutorReady,
		onInteractionEvent
	}
}
