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

import type { ViewerCommandExecutor } from '@vctrl/viewer'

const HOST_ORIGIN = 'https://shop.example'

const command = {
	source: HOSTED_PREVIEW_HOST_SOURCE,
	type: 'viewer_command',
	command: { type: 'activate_camera', cameraId: 'detail' }
}
const ping = { source: HOSTED_PREVIEW_HOST_SOURCE, type: 'ping' }

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

function mountBridge() {
	const execute = vi.fn()
	const { result } = renderHook(() =>
		useHostedPreviewBridge({ sceneId: 'scene-1' })
	)
	act(() => {
		result.current.onCommandExecutorReady?.({
			execute
		} as ViewerCommandExecutor)
	})
	return { execute, bridge: result.current }
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

		expect(replies).toEqual([{ type: 'pong', origin: HOST_ORIGIN }])
	})

	it('holds events until the parent speaks, then sends them only there', () => {
		const { bridge } = mountBridge()

		act(() => {
			bridge.onInteractionEvent?.({ type: 'viewer_ready' })
		})
		post(ping, { source: newWindow(), origin: 'https://other.example' })
		post({ hello: 'not the protocol' }, { origin: 'https://noise.example' })
		expect(replies).toEqual([])

		post(ping)

		expect(replies).toEqual([
			{ type: 'viewer_event', origin: HOST_ORIGIN },
			{ type: 'pong', origin: HOST_ORIGIN }
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
		const { bridge } = mountBridge()

		act(() => {
			bridge.onInteractionEvent?.({ type: 'viewer_ready' })
		})
		post(ping, { source: window })

		expect(sent.mock.calls.map(([message]) => message.type)).toEqual(['pong'])
	})

	it('replies with the viewer source', () => {
		mountBridge()

		post(ping)

		expect(vi.mocked(parent.postMessage).mock.calls[0][0]).toEqual(
			expect.objectContaining({ source: HOSTED_PREVIEW_VIEWER_SOURCE })
		)
	})
})
