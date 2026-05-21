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

export interface HostedPreviewPongMessage {
	source: typeof HOSTED_PREVIEW_VIEWER_SOURCE
	type: 'pong'
	sceneId?: string
	cameras: EmbedCameraDescriptor[]
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
		default:
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
