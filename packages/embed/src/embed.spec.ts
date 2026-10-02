// @vitest-environment jsdom
/**
 * A `VectrealEmbed` hears only its own iframe.
 *
 * Every Vectreal embed on a page posts from the same origin, so the SDK's
 * origin check alone let a second embed's `pong` land on the first instance:
 * its `ready()` resolved with the other scene's id, cameras and hotspots.
 */
import { afterEach, describe, expect, it } from 'vitest'

import { VectrealEmbed } from './embed'
import { HOSTED_PREVIEW_VIEWER_SOURCE } from './protocol'

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
