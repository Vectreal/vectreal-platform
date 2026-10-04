// @vitest-environment jsdom
/**
 * A `VectrealEmbed` hears only its own iframe.
 *
 * Every Vectreal embed on a page posts from the same origin, so the SDK's
 * origin check alone let a second embed's `pong` land on the first instance:
 * its `ready()` resolved with the other scene's id, cameras and hotspots.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

import { VectrealEmbed } from './embed'
import { HOSTED_PREVIEW_VIEWER_SOURCE, isViewerCommand } from './protocol'

const ORIGIN = 'https://vectreal.com'

function iframe(sceneId: string): HTMLIFrameElement {
	const frame = document.createElement('iframe')
	frame.src = `${ORIGIN}/embed/project/${sceneId}`
	document.body.appendChild(frame)
	return frame
}

function pong(from: HTMLIFrameElement, sceneId: string) {
	window.dispatchEvent(
		new MessageEvent('message', {
			origin: ORIGIN,
			source: from.contentWindow,
			data: {
				source: HOSTED_PREVIEW_VIEWER_SOURCE,
				type: 'pong',
				sceneId,
				cameras: [{ id: `${sceneId}-camera`, name: 'Main' }],
				hotspots: []
			}
		})
	)
}

function viewerReady(from: HTMLIFrameElement) {
	window.dispatchEvent(
		new MessageEvent('message', {
			origin: ORIGIN,
			source: from.contentWindow,
			data: {
				source: HOSTED_PREVIEW_VIEWER_SOURCE,
				type: 'viewer_event',
				sceneId: 'scene-a',
				event: { type: 'viewer_ready' }
			}
		})
	)
}

afterEach(() => {
	document.body.replaceChildren()
})

describe('VectrealEmbed message source', () => {
	it('takes the pong of its own iframe', async () => {
		const own = iframe('scene-a')
		const embed = new VectrealEmbed(own, { readyTimeout: 50 })

		pong(own, 'scene-a')

		await expect(embed.ready()).resolves.toMatchObject({ sceneId: 'scene-a' })
		embed.destroy()
	})

	it('ignores another embed on the same page', async () => {
		const own = iframe('scene-a')
		const other = iframe('scene-b')
		const embed = new VectrealEmbed(own, { readyTimeout: 50 })

		pong(other, 'scene-b')

		await expect(embed.ready()).rejects.toThrow(/did not become ready/)
		embed.destroy()
	})
})

describe('VectrealEmbed readiness', () => {
	// The frame answers every ping, and a ping can cross its answer.
	it('tells its listeners once, however often the frame announces it', () => {
		const own = iframe('scene-a')
		const embed = new VectrealEmbed(own)
		const onReady = vi.fn()
		embed.on('viewer_ready', onReady)

		pong(own, 'scene-a')
		viewerReady(own)
		pong(own, 'scene-a')
		viewerReady(own)

		expect(onReady).toHaveBeenCalledTimes(1)
		embed.destroy()
	})
})

describe('VectrealEmbed.returnToSceneView', () => {
	// The command has to survive the frame's own guard, or it is dropped there
	// without a word on either side.
	it('sends a command the frame accepts', () => {
		const own = iframe('scene-a')
		const embed = new VectrealEmbed(own)
		pong(own, 'scene-a')
		viewerReady(own)

		const post = vi.spyOn(own.contentWindow as Window, 'postMessage')
		embed.returnToSceneView()

		const message = post.mock.calls.at(-1)?.[0] as { command: unknown }
		expect(message.command).toEqual({ type: 'return_to_scene_view' })
		expect(isViewerCommand(message.command)).toBe(true)
		embed.destroy()
	})
})
