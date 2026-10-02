// @vitest-environment jsdom
/**
 * The handshake between `@vctrl/embed` and the hosted preview, end to end.
 *
 * Each half was right on its own terms and the pair was wrong: the SDK reads a
 * pong as "the viewer accepts commands" and flushes everything it queued, and
 * the bridge sent that pong while the scene was still loading. A command issued
 * straight after constructing the SDK reached a viewer that did not exist yet,
 * and the pong carried an unloaded scene's empty camera list.
 *
 * Readiness must also not wait on the canvas, which mounts only near the
 * viewport: no `viewer_ready` from the viewer is sent here, as none is sent
 * for a frame below the fold.
 *
 * So this runs the real SDK class against the real bridge hook, wired through
 * two jsdom windows standing in for the host page and the iframe. Messages are
 * delivered on a later task, as a browser delivers them.
 */
import { act, renderHook } from '@testing-library/react'
import { VectrealEmbed } from '@vctrl/embed'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useHostedPreviewBridge } from './hosted-preview-bridge'

import type { CameraConfig } from '@vctrl/core'
import type { ViewerCommandExecutor } from '@vctrl/viewer'

const HOST_ORIGIN = 'https://shop.example'
const PREVIEW_ORIGIN = 'https://vectreal.com'

const ownParent = Object.getOwnPropertyDescriptor(window, 'parent')

let hostWindow: Window
let iframe: HTMLIFrameElement

function deliver(data: unknown, origin: string, source: Window) {
	setTimeout(() => {
		window.dispatchEvent(new MessageEvent('message', { data, origin, source }))
	})
}

/** Let every message in flight arrive, including the replies it causes. */
async function settle() {
	for (let i = 0; i < 5; i++) {
		await act(() => new Promise((resolve) => setTimeout(resolve)))
	}
}

beforeEach(() => {
	const hostFrame = document.createElement('iframe')
	document.body.appendChild(hostFrame)
	hostWindow = hostFrame.contentWindow as Window

	iframe = document.createElement('iframe')
	iframe.src = `${PREVIEW_ORIGIN}/embed/project/scene-1`
	document.body.appendChild(iframe)
	const previewWindow = iframe.contentWindow as Window

	// The preview frame's parent is the host page.
	Object.defineProperty(window, 'parent', {
		configurable: true,
		value: hostWindow
	})
	// The SDK posts into the iframe; the bridge receives it from the host.
	vi.spyOn(previewWindow, 'postMessage').mockImplementation(((data: unknown) =>
		deliver(data, HOST_ORIGIN, hostWindow)) as typeof window.postMessage)
	// The bridge posts to its parent; the SDK receives it from the iframe.
	vi.spyOn(hostWindow, 'postMessage').mockImplementation(((data: unknown) =>
		deliver(data, PREVIEW_ORIGIN, previewWindow)) as typeof window.postMessage)
})

afterEach(() => {
	vi.restoreAllMocks()
	if (ownParent) Object.defineProperty(window, 'parent', ownParent)
	document.body.replaceChildren()
})

describe('embed handshake', () => {
	it('runs a command issued before the viewer exists, once it does', async () => {
		const execute = vi.fn()
		const { result, rerender } = renderHook(
			({ cameras }: { cameras?: CameraConfig[] }) =>
				useHostedPreviewBridge({ sceneId: 'scene-1', cameras }),
			{ initialProps: {} }
		)

		const embed = new VectrealEmbed(iframe, { readyTimeout: 2000 })
		embed.activateCamera('detail')
		const ready = embed.ready()
		// The scene is still loading while the SDK pings and waits.
		await settle()

		// The scene data arrives, and the embed page mounts the viewer.
		rerender({
			cameras: [{ cameraId: 'detail', name: 'Detail' } as CameraConfig]
		})
		act(() => {
			result.current.onCommandExecutorReady?.({
				execute
			} as ViewerCommandExecutor)
		})
		await settle()

		await expect(ready).resolves.toMatchObject({
			sceneId: 'scene-1',
			cameras: [{ id: 'detail', name: 'Detail' }]
		})
		expect(execute).toHaveBeenCalledWith({
			type: 'activate_camera',
			cameraId: 'detail'
		})
		embed.destroy()
	})

	it('readies an SDK created after the first one', async () => {
		const { result } = renderHook(() =>
			useHostedPreviewBridge({ sceneId: 'scene-1' })
		)
		act(() => {
			result.current.onCommandExecutorReady?.({
				execute: vi.fn()
			} as ViewerCommandExecutor)
		})

		// A host that tears its embed down and builds it again, as React's
		// StrictMode does in development.
		const first = new VectrealEmbed(iframe, { readyTimeout: 2000 })
		const firstReady = first.ready()
		await settle()
		await expect(firstReady).resolves.toMatchObject({ sceneId: 'scene-1' })
		first.destroy()

		const second = new VectrealEmbed(iframe, { readyTimeout: 2000 })
		const secondReady = second.ready()
		await settle()

		await expect(secondReady).resolves.toMatchObject({ sceneId: 'scene-1' })
		second.destroy()
	})
})
