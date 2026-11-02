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

describe('VectrealEmbed.seekAnimationClip', () => {
	it('sends a command the frame accepts', () => {
		const own = iframe('scene-a')
		const embed = new VectrealEmbed(own)
		pong(own, 'scene-a')
		viewerReady(own)

		const post = vi.spyOn(own.contentWindow as Window, 'postMessage')
		embed.seekAnimationClip('spin', 1.25)

		const message = post.mock.calls.at(-1)?.[0] as { command: unknown }
		expect(message.command).toEqual({
			type: 'seek_animation_clip',
			clipId: 'spin',
			time: 1.25
		})
		expect(isViewerCommand(message.command)).toBe(true)
		embed.destroy()
	})
})

function viewerEvent(from: HTMLIFrameElement, event: object) {
	window.dispatchEvent(
		new MessageEvent('message', {
			origin: ORIGIN,
			source: from.contentWindow,
			data: {
				source: HOSTED_PREVIEW_VIEWER_SOURCE,
				type: 'viewer_event',
				sceneId: 'scene-a',
				event
			}
		})
	)
}

describe('VectrealEmbed environment fallback', () => {
	it('passes on which map loaded', () => {
		const own = iframe('scene-a')
		const embed = new VectrealEmbed(own)
		const onLoaded = vi.fn()
		embed.on('environment_loaded', onLoaded)

		viewerEvent(own, {
			type: 'environment_loaded',
			files: ['https://maps.example/studio.hdr']
		})

		expect(onLoaded).toHaveBeenCalledWith({
			files: ['https://maps.example/studio.hdr']
		})
		embed.destroy()
	})

	// The scene stays lit by a room, so this event is all the host page gets.
	it('passes on which map failed', () => {
		const own = iframe('scene-a')
		const embed = new VectrealEmbed(own)
		const onFailed = vi.fn()
		embed.on('environment_load_failed', onFailed)

		window.dispatchEvent(
			new MessageEvent('message', {
				origin: ORIGIN,
				source: own.contentWindow,
				data: {
					source: HOSTED_PREVIEW_VIEWER_SOURCE,
					type: 'viewer_event',
					sceneId: 'scene-a',
					event: {
						type: 'environment_load_failed',
						files: ['https://maps.example/studio.hdr']
					}
				}
			})
		)

		expect(onFailed).toHaveBeenCalledWith({
			files: ['https://maps.example/studio.hdr']
		})
		embed.destroy()
	})
})

describe('VectrealEmbed lost context', () => {
	// A blank canvas fails nothing on the host page, so these are its only sign.
	it('passes on the loss, the restore and the give-up with its reason', () => {
		const own = iframe('scene-a')
		const embed = new VectrealEmbed(own)
		const onLost = vi.fn()
		const onRestored = vi.fn()
		const onFailed = vi.fn()
		embed.on('context_lost', onLost)
		embed.on('context_restored', onRestored)
		embed.on('render_failed', onFailed)

		viewerEvent(own, { type: 'context_lost' })
		viewerEvent(own, { type: 'context_restored' })
		viewerEvent(own, { type: 'render_failed', reason: 'context_lost' })

		expect(onLost).toHaveBeenCalledOnce()
		expect(onRestored).toHaveBeenCalledOnce()
		expect(onFailed).toHaveBeenCalledWith({ reason: 'context_lost' })
		embed.destroy()
	})
})

describe('VectrealEmbed skipped shadow bake', () => {
	it('passes on why the viewer drew a contact shadow instead', () => {
		const own = iframe('scene-a')
		const embed = new VectrealEmbed(own)
		const onSkipped = vi.fn()
		embed.on('shadow_bake_skipped', onSkipped)

		viewerEvent(own, {
			type: 'shadow_bake_skipped',
			reason: 'touch_device',
			estimatedDraws: 21_632
		})

		expect(onSkipped).toHaveBeenCalledWith({
			reason: 'touch_device',
			estimatedDraws: 21_632
		})
		embed.destroy()
	})
})
