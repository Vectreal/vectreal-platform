// @vitest-environment jsdom
/**
 * Who the hosted preview bridge listens to, and who hears back.
 *
 * The bridge used to pin its reply origin from the first message any window
 * sent, of any shape, and then obey every protocol message whatever its
 * sender. Another frame could drive the viewer, and whichever window spoke
 * first received the scene's cameras, hotspots and events.
 *
 * These go through the hook's real listener, with the frame's parent set to a
 * separate window, so they fail if the check exists but is not the one the
 * frame runs.
 */
import { act, renderHook } from '@testing-library/react'
import {
	HOSTED_PREVIEW_HOST_SOURCE,
	HOSTED_PREVIEW_VIEWER_SOURCE
} from '@vctrl/embed'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useHostedPreviewBridge } from './hosted-preview-bridge'

import type { SceneInteractionDefinition } from '@vctrl/core'
import type { ViewerCommand, ViewerCommandExecutor } from '@vctrl/viewer'

const HOST_ORIGIN = 'https://shop.example'

const command = {
	source: HOSTED_PREVIEW_HOST_SOURCE,
	type: 'viewer_command',
	command: { type: 'activate_camera', cameraId: 'detail' }
}
const ping = { source: HOSTED_PREVIEW_HOST_SOURCE, type: 'ping' }
const scrollToDetail: SceneInteractionDefinition = {
	trigger: {
		source: 'host',
		type: 'host_scroll_progress',
		start: 0,
		end: 1
	},
	actions: [{ type: 'activate_camera', cameraId: 'detail' }]
}
const scrollTo = (progress: number) => ({
	source: HOSTED_PREVIEW_HOST_SOURCE,
	type: 'host_scroll_progress',
	progress
})

function newWindow(): Window {
	const frame = document.createElement('iframe')
	document.body.appendChild(frame)
	return frame.contentWindow as Window
}

let parent: Window
let replies: Array<{ type?: string; origin: string }>
const ownParent = Object.getOwnPropertyDescriptor(window, 'parent')

function setParent(value: Window) {
	Object.defineProperty(window, 'parent', { configurable: true, value })
}

beforeEach(() => {
	parent = newWindow()
	setParent(parent)
	replies = []
	vi.spyOn(parent, 'postMessage').mockImplementation(((
		message: { type?: string },
		origin: string
	) => {
		replies.push({ type: message.type, origin })
	}) as typeof window.postMessage)
})

afterEach(() => {
	vi.restoreAllMocks()
	if (ownParent) Object.defineProperty(window, 'parent', ownParent)
	document.body.replaceChildren()
})

function post(
	data: unknown,
	{
		origin = HOST_ORIGIN,
		source = parent
	}: { origin?: string; source?: Window } = {}
) {
	act(() => {
		window.dispatchEvent(new MessageEvent('message', { data, origin, source }))
	})
}

function renderBridge() {
	return renderHook(() => useHostedPreviewBridge({ sceneId: 'scene-1' })).result
		.current
}

function register(bridge: ReturnType<typeof renderBridge>) {
	const execute = vi.fn()
	act(() => {
		bridge.onCommandExecutorReady?.({ execute } as ViewerCommandExecutor)
	})
	return execute
}

function mountBridge() {
	const bridge = renderBridge()
	return { execute: register(bridge), bridge }
}

describe('hosted preview bridge listener', () => {
	it('obeys the embedding page', () => {
		const { execute } = mountBridge()

		post(command)

		expect(execute).toHaveBeenCalledWith(command.command)
	})

	it('ignores a protocol message from any other window', () => {
		const { execute } = mountBridge()

		post(command, { source: newWindow() })
		post(ping, { source: newWindow(), origin: 'https://other.example' })

		expect(execute).not.toHaveBeenCalled()
		expect(replies).toEqual([])
	})

	it('pins the reply origin from the parent, not from noise', () => {
		mountBridge()

		post({ hello: 'not the protocol' }, { origin: 'https://noise.example' })
		post(ping)

		expect(replies.map(({ origin }) => origin)).toEqual([
			HOST_ORIGIN,
			HOST_ORIGIN
		])
	})

	it('holds events until the parent speaks, then sends them only there', () => {
		mountBridge()

		post(ping, { source: newWindow(), origin: 'https://other.example' })
		post({ hello: 'not the protocol' }, { origin: 'https://noise.example' })
		expect(replies).toEqual([])

		post(ping)

		expect(replies).toEqual([
			{ type: 'pong', origin: HOST_ORIGIN },
			{ type: 'viewer_event', origin: HOST_ORIGIN }
		])
	})

	it('still obeys a parent whose origin is opaque, without replying', () => {
		const { execute } = mountBridge()

		post(command, { origin: 'null' })
		post(ping, { origin: 'null' })

		expect(execute).toHaveBeenCalledWith(command.command)
		expect(replies).toEqual([])
	})

	it('sends nothing when it is the top-level page', () => {
		// The frame is its own parent here, as /preview is.
		setParent(window)
		const sent = vi.spyOn(window, 'postMessage').mockImplementation(() => {})
		mountBridge()

		post(ping, { source: window })

		expect(sent.mock.calls.map(([message]) => message.type)).toEqual([
			'pong',
			'viewer_event'
		])
	})

	it('does not answer a ping before the viewer accepts commands', () => {
		renderBridge()

		post(ping)

		expect(replies).toEqual([])
	})

	it('answers a waiting parent once the viewer accepts commands, pong first', () => {
		const bridge = renderBridge()
		post(ping)

		register(bridge)

		expect(replies).toEqual([
			{ type: 'pong', origin: HOST_ORIGIN },
			{ type: 'viewer_event', origin: HOST_ORIGIN }
		])
	})

	it('announces readiness once, not on every canvas mount', () => {
		const { bridge } = mountBridge()
		post(ping)
		replies = []

		act(() => {
			bridge.onInteractionEvent?.({ type: 'viewer_ready' })
			bridge.onInteractionEvent?.({ type: 'camera_changed', cameraId: 'a' })
		})

		expect(replies).toEqual([{ type: 'viewer_event', origin: HOST_ORIGIN }])
	})

	it("runs the author's defaults before telling the page it is ready", () => {
		const front: ViewerCommand = { type: 'activate_camera', cameraId: 'front' }
		const { result } = renderHook(() =>
			useHostedPreviewBridge({ sceneId: 'scene-1', initialCommands: [front] })
		)
		post(ping)

		const execute = register(result.current)

		expect(execute).toHaveBeenCalledWith(front)
		// A host command sent after ready() must replace the default, so the
		// default has to reach the viewer first.
		expect(execute.mock.invocationCallOrder[0]).toBeLessThan(
			vi.mocked(parent.postMessage).mock.invocationCallOrder[0]
		)
	})

	it('does not announce a viewer that has already gone', () => {
		const bridge = renderBridge()
		register(bridge)
		act(() => {
			bridge.onCommandExecutorReady?.(null)
		})

		post(ping)

		expect(replies).toEqual([])
	})

	it('replays the scroll position on a canvas remount, not on the first mount', () => {
		const { result } = renderHook(() =>
			useHostedPreviewBridge({
				sceneId: 'scene-1',
				interactions: [scrollToDetail]
			})
		)
		const execute = register(result.current)
		post({
			source: HOSTED_PREVIEW_HOST_SOURCE,
			type: 'host_scroll_progress',
			progress: 0.5
		})
		expect(execute).toHaveBeenCalledTimes(1)

		act(() => result.current.onInteractionEvent?.({ type: 'viewer_ready' }))
		expect(execute).toHaveBeenCalledTimes(1)

		act(() => result.current.onInteractionEvent?.({ type: 'viewer_ready' }))
		expect(execute).toHaveBeenCalledTimes(2)
	})

	it('runs a scroll position sent while the scene loaded', () => {
		const { result } = renderHook(() =>
			useHostedPreviewBridge({
				sceneId: 'scene-1',
				interactions: [scrollToDetail]
			})
		)
		post(scrollTo(0.5))

		const execute = register(result.current)
		post(scrollTo(0.6))

		expect(execute).toHaveBeenCalledTimes(1)
		expect(execute).toHaveBeenCalledWith({
			type: 'activate_camera',
			cameraId: 'detail'
		})
	})

	it('announces readiness to every ping, for an SDK created later', () => {
		const bridge = renderBridge()
		post(ping)
		register(bridge)
		post(ping)

		expect(replies.map(({ type }) => type)).toEqual([
			'pong',
			'viewer_event',
			'pong',
			'viewer_event'
		])
	})

	it('stops answering once the viewer is gone', () => {
		const { bridge } = mountBridge()
		post(ping)
		replies = []

		act(() => {
			bridge.onCommandExecutorReady?.(null)
		})
		post(ping)

		expect(replies).toEqual([])
	})

	it('replies with the viewer source', () => {
		mountBridge()

		post(ping)

		expect(vi.mocked(parent.postMessage).mock.calls[0][0]).toEqual(
			expect.objectContaining({ source: HOSTED_PREVIEW_VIEWER_SOURCE })
		)
	})
})
