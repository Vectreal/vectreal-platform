import type { ViewerCommand, ViewerInteractionEvent } from '@vctrl/viewer'

export const HOSTED_PREVIEW_HOST_SOURCE = 'vectreal-host'
export const HOSTED_PREVIEW_VIEWER_SOURCE = 'vectreal-preview'

// ---------------------------------------------------------------------------
// Incoming messages (parent page → iframe)
// ---------------------------------------------------------------------------

export interface HostedPreviewPingMessage {
	source: typeof HOSTED_PREVIEW_HOST_SOURCE
	type: 'ping'
}

export interface HostedPreviewViewerCommandMessage {
	source: typeof HOSTED_PREVIEW_HOST_SOURCE
	type: 'viewer_command'
	command: ViewerCommand
}

export interface HostedPreviewScrollProgressMessage {
	source: typeof HOSTED_PREVIEW_HOST_SOURCE
	type: 'host_scroll_progress'
	progress: number
}

export interface HostedPreviewHostMessage {
	source: typeof HOSTED_PREVIEW_HOST_SOURCE
	type: 'host_message'
	message: string
	payload?: Record<string, unknown>
}

export type HostedPreviewIncomingMessage =
	| HostedPreviewHostMessage
	| HostedPreviewPingMessage
	| HostedPreviewScrollProgressMessage
	| HostedPreviewViewerCommandMessage

// ---------------------------------------------------------------------------
// Outgoing messages (iframe → parent page)
// ---------------------------------------------------------------------------

export interface EmbedCameraDescriptor {
	id: string
	name: string
	fov?: number
}

/**
 * One hotspot, as a host page sees it.
 *
 * Carries no body, no link and no world position: a host builds navigation
 * from these, and the content is what the viewer draws. Adding the text here
 * would put a second copy of it on the page with nothing keeping the two in
 * step.
 */
export interface EmbedHotspotDescriptor {
	id: string
	name: string
	/** The camera this hotspot flies, or null when it only reveals content. */
	cameraId: string | null
	/** 1-based place in the navigation sequence, or null when it has none. */
	step: number | null
}

export interface HostedPreviewPongMessage {
	source: typeof HOSTED_PREVIEW_VIEWER_SOURCE
	type: 'pong'
	sceneId?: string
	cameras: EmbedCameraDescriptor[]
	/**
	 * Optional, unlike `cameras`.
	 *
	 * An iframe and the SDK on the page around it are two separately deployed
	 * artifacts and can be versions apart. A required field here would make an
	 * older iframe's pong fail a newer SDK's parse, and the host would then hang
	 * waiting for a handshake that already arrived.
	 */
	hotspots?: EmbedHotspotDescriptor[]
}

export interface HostedPreviewViewerEventMessage {
	source: typeof HOSTED_PREVIEW_VIEWER_SOURCE
	type: 'viewer_event'
	sceneId?: string
	event: ViewerInteractionEvent
}

export interface HostedPreviewCustomEventMessage {
	source: typeof HOSTED_PREVIEW_VIEWER_SOURCE
	type: 'interaction_event'
	sceneId?: string
	interactionId?: string
	eventName: string
	payload?: Record<string, unknown>
}

export type HostedPreviewOutgoingMessage =
	| HostedPreviewCustomEventMessage
	| HostedPreviewPongMessage
	| HostedPreviewViewerEventMessage

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isViewerCommand(value: unknown): value is ViewerCommand {
	if (!isRecord(value) || typeof value.type !== 'string') {
		return false
	}

	switch (value.type) {
		case 'activate_camera':
			return (
				typeof value.cameraId === 'string' && value.cameraId.trim().length > 0
			)
		case 'focus_hotspot':
			return (
				typeof value.hotspotId === 'string' && value.hotspotId.trim().length > 0
			)
		case 'set_controls_enabled':
			return typeof value.enabled === 'boolean'
		case 'set_auto_rotate':
			return (
				typeof value.enabled === 'boolean' &&
				(value.speed === undefined || typeof value.speed === 'number')
			)
		case 'set_controls_options':
			return (
				(value.zoom === undefined || typeof value.zoom === 'boolean') &&
				(value.pan === undefined || typeof value.pan === 'boolean')
			)
		case 'set_transition':
			return (
				typeof value.transitionType === 'string' &&
				['none', 'linear', 'object_avoidance'].includes(
					value.transitionType as string
				)
			)
		case 'set_animation_playing':
			return typeof value.playing === 'boolean'
		case 'restart_animation':
			return true
		case 'seek_animation_clip':
			return (
				typeof value.clipId === 'string' &&
				value.clipId.trim().length > 0 &&
				typeof value.time === 'number' &&
				Number.isFinite(value.time) &&
				value.time >= 0
			)
		default:
			// Any command without a case above is dropped here, silently and with
			// no error on either side of the iframe. A new command type must be
			// added to this switch or it will simply never arrive.
			return false
	}
}

export function isHostedPreviewIncomingMessage(
	value: unknown
): value is HostedPreviewIncomingMessage {
	if (
		!isRecord(value) ||
		value.source !== HOSTED_PREVIEW_HOST_SOURCE ||
		typeof value.type !== 'string'
	) {
		return false
	}

	switch (value.type) {
		case 'ping':
			return true
		case 'viewer_command':
			return isViewerCommand(value.command)
		case 'host_scroll_progress':
			return (
				typeof value.progress === 'number' && Number.isFinite(value.progress)
			)
		case 'host_message':
			return (
				typeof value.message === 'string' &&
				value.message.trim().length > 0 &&
				(value.payload === undefined || isRecord(value.payload))
			)
		default:
			return false
	}
}
