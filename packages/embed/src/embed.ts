import {
	HOSTED_PREVIEW_HOST_SOURCE,
	HOSTED_PREVIEW_VIEWER_SOURCE,
	type EmbedCameraDescriptor,
	type HostedPreviewOutgoingMessage
} from './protocol'

import type { ViewerCommand, ViewerInteractionEvent } from '@vctrl/viewer'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface EmbedOptions {
	/** Override the detected iframe origin for postMessage targeting. */
	iframeOrigin?: string
	/** Milliseconds before ready() rejects. Default: 15 000. */
	readyTimeout?: number
}

export interface EmbedReadyInfo {
	sceneId: string | undefined
	cameras: EmbedCameraDescriptor[]
}

export interface SetTransitionOptions {
	type: 'none' | 'linear' | 'object_avoidance'
	duration?: number
	easing?: 'linear' | 'ease_in' | 'ease_out' | 'ease_in_out'
}

export type EmbedEventMap = {
	viewer_ready: void
	model_loaded: void
	camera_changed: { cameraId: string }
	auto_rotate_changed: { enabled: boolean }
	interaction_event: {
		interactionId?: string
		eventName: string
		payload?: Record<string, unknown>
	}
}

export type EmbedEventType = keyof EmbedEventMap
export type EmbedEventHandler<K extends EmbedEventType> = (
	data: EmbedEventMap[K]
) => void

// ---------------------------------------------------------------------------
// VectrealEmbed
// ---------------------------------------------------------------------------

const DEFAULT_READY_TIMEOUT_MS = 15_000

export class VectrealEmbed {
	private readonly iframe: HTMLIFrameElement
	private readonly targetOrigin: string
	private readonly readyTimeout: number

	private handlers = new Map<
		EmbedEventType,
		Set<EmbedEventHandler<EmbedEventType>>
	>()
	private pendingCommands: Array<{
		source: string
		type: string
		[key: string]: unknown
	}> = []
	private isReady = false
	private boundListener: (event: MessageEvent<unknown>) => void

	constructor(iframe: HTMLIFrameElement, options: EmbedOptions = {}) {
		this.iframe = iframe
		this.readyTimeout = options.readyTimeout ?? DEFAULT_READY_TIMEOUT_MS

		const src = iframe.src || iframe.getAttribute('src') || ''
		this.targetOrigin =
			options.iframeOrigin ?? (src ? new URL(src).origin : '*')

		this.boundListener = this.handleMessage.bind(this)
		window.addEventListener('message', this.boundListener)

		// Dispatch ping immediately so the iframe knows a host is listening.
		// Commands sent before pong are queued.
		this.postToIframe({ source: HOSTED_PREVIEW_HOST_SOURCE, type: 'ping' })
	}

	// ---------------------------------------------------------------------------
	// Lifecycle
	// ---------------------------------------------------------------------------

	/**
	 * Resolves when the embedded viewer emits viewer_ready.
	 * Rejects if no response within readyTimeout.
	 */
	ready(): Promise<EmbedReadyInfo> {
		return new Promise((resolve, reject) => {
			const timer = window.setTimeout(() => {
				this.off('viewer_ready', onReady as EmbedEventHandler<'viewer_ready'>)
				reject(
					new Error(
						`VectrealEmbed: viewer did not become ready within ${this.readyTimeout}ms`
					)
				)
			}, this.readyTimeout)

			const onReady = () => {
				window.clearTimeout(timer)
				resolve({
					sceneId: this.sceneId,
					cameras: this.cameras
				})
			}

			if (this.isReady) {
				window.clearTimeout(timer)
				resolve({ sceneId: this.sceneId, cameras: this.cameras })
				return
			}

			this.on('viewer_ready', onReady as EmbedEventHandler<'viewer_ready'>)
		})
	}

	/** Remove all listeners and stop responding to messages. */
	destroy(): void {
		window.removeEventListener('message', this.boundListener)
		this.handlers.clear()
		this.pendingCommands = []
	}

	// ---------------------------------------------------------------------------
	// Commands
	// ---------------------------------------------------------------------------

	/** Switch to a named camera. */
	activateCamera(cameraId: string): void {
		this.sendCommand({ type: 'activate_camera', cameraId })
	}

	/** Override the transition behaviour for subsequent camera switches. */
	setTransition(options: SetTransitionOptions): void {
		this.sendCommand({
			type: 'set_transition',
			transitionType: options.type,
			duration: options.duration,
			easing: options.easing
		})
	}

	/** Enable or disable orbit controls. */
	setControlsEnabled(enabled: boolean): void {
		this.sendCommand({ type: 'set_controls_enabled', enabled })
	}

	/** Toggle auto-rotate. */
	setAutoRotate(enabled: boolean, speed?: number): void {
		this.sendCommand({ type: 'set_auto_rotate', enabled, speed })
	}

	/** Toggle scroll-zoom. */
	setZoomEnabled(enabled: boolean): void {
		this.sendCommand({ type: 'set_controls_options', zoom: enabled })
	}

	/** Toggle right-click pan. */
	setPanEnabled(enabled: boolean): void {
		this.sendCommand({ type: 'set_controls_options', pan: enabled })
	}

	/**
	 * Drive scroll-triggered interactions defined in the Publisher.
	 * @param progress 0 (page top) – 1 (page bottom)
	 */
	sendScrollProgress(progress: number): void {
		this.postToIframe({
			source: HOSTED_PREVIEW_HOST_SOURCE,
			type: 'host_scroll_progress',
			progress: Math.min(1, Math.max(0, progress))
		})
	}

	/**
	 * Trigger a named host_message interaction defined in the Publisher.
	 */
	sendMessage(message: string, payload?: Record<string, unknown>): void {
		this.postToIframe({
			source: HOSTED_PREVIEW_HOST_SOURCE,
			type: 'host_message',
			message,
			payload
		})
	}

	// ---------------------------------------------------------------------------
	// Events
	// ---------------------------------------------------------------------------

	/** Subscribe to a viewer event. Returns an unsubscribe function. */
	on<K extends EmbedEventType>(
		type: K,
		handler: EmbedEventHandler<K>
	): () => void {
		if (!this.handlers.has(type)) {
			this.handlers.set(type, new Set())
		}
		this.handlers.get(type)!.add(handler as EmbedEventHandler<EmbedEventType>)
		return () => this.off(type, handler)
	}

	/** Remove a specific handler. */
	off<K extends EmbedEventType>(type: K, handler: EmbedEventHandler<K>): void {
		this.handlers
			.get(type)
			?.delete(handler as EmbedEventHandler<EmbedEventType>)
	}

	// ---------------------------------------------------------------------------
	// Internal state (populated via pong)
	// ---------------------------------------------------------------------------

	private sceneId: string | undefined = undefined
	private cameras: EmbedCameraDescriptor[] = []

	// ---------------------------------------------------------------------------
	// Private helpers
	// ---------------------------------------------------------------------------

	private sendCommand(command: ViewerCommand): void {
		const message = {
			source: HOSTED_PREVIEW_HOST_SOURCE,
			type: 'viewer_command' as const,
			command
		}

		if (!this.isReady) {
			this.pendingCommands.push(message)
			return
		}

		this.postToIframe(message)
	}

	private postToIframe(message: Record<string, unknown>): void {
		try {
			this.iframe.contentWindow?.postMessage(message, this.targetOrigin)
		} catch {
			// iframe may not be loaded yet; silently discard
		}
	}

	private flushPendingCommands(): void {
		for (const cmd of this.pendingCommands) {
			this.postToIframe(cmd)
		}
		this.pendingCommands = []
	}

	private emit<K extends EmbedEventType>(
		type: K,
		data: EmbedEventMap[K]
	): void {
		this.handlers.get(type)?.forEach((handler) => {
			;(handler as EmbedEventHandler<K>)(data)
		})
	}

	private handleMessage(event: MessageEvent<unknown>): void {
		const data = event.data as HostedPreviewOutgoingMessage

		if (
			!data ||
			typeof data !== 'object' ||
			data.source !== HOSTED_PREVIEW_VIEWER_SOURCE
		) {
			return
		}

		// Validate the message origin matches our iframe
		if (this.targetOrigin !== '*' && event.origin !== this.targetOrigin) {
			return
		}

		switch (data.type) {
			case 'pong':
				this.sceneId = data.sceneId
				this.cameras = data.cameras
				this.isReady = true
				this.flushPendingCommands()
				break

			case 'viewer_event':
				this.handleViewerEvent(data.event)
				break

			case 'interaction_event':
				this.emit('interaction_event', {
					interactionId: data.interactionId,
					eventName: data.eventName,
					payload: data.payload
				})
				break
		}
	}

	private handleViewerEvent(event: ViewerInteractionEvent): void {
		switch (event.type) {
			case 'viewer_ready':
				this.isReady = true
				this.flushPendingCommands()
				this.emit('viewer_ready', undefined as void)
				break
			case 'model_loaded':
				this.emit('model_loaded', undefined as void)
				break
			case 'camera_changed':
				this.emit('camera_changed', { cameraId: event.cameraId })
				break
			case 'auto_rotate_changed':
				this.emit('auto_rotate_changed', { enabled: event.enabled })
				break
			case 'initial_framing_completed':
				// Translate to model_loaded for embed consumers — signals scene is visible
				this.emit('model_loaded', undefined as void)
				break
		}
	}
}
