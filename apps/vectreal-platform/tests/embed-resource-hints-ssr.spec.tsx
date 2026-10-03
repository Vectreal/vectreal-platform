/**
 * The hints really reach the server-rendered head, in the form a browser
 * matches against the later requests: `crossorigin` on every one, `as` set,
 * the model at high priority.
 */
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { EmbedResourceHints } from '../app/components/scene-embed/embed-resource-hints'

import type { SceneEmbedManifestResponse } from '../app/types/api'

const manifest: SceneEmbedManifestResponse = {
	sceneId: 's1',
	meta: null,
	publishedModel: {
		url: '/api/scenes/s1/assets/glb-1?exp=1&sig=a',
		fileName: 'shoe.glb',
		mimeType: 'model/gltf-binary',
		byteSize: 10,
		usesDraco: true
	},
	assetRefs: {},
	settings: null,
	settingsUpdatedAt: null
}

describe('the embed document head', () => {
	const html = renderToString(
		<html>
			<head />
			<body>
				<EmbedResourceHints manifest={manifest} />
			</body>
		</html>
	)
	const head = html.slice(html.indexOf('<head>'), html.indexOf('</head>'))

	it('preloads the model as a CORS fetch at high priority', () => {
		expect(head).toContain(
			'<link rel="preload" href="/api/scenes/s1/assets/glb-1?exp=1&amp;sig=a" as="fetch" crossorigin="" fetchPriority="high"/>'
		)
	})

	it('preloads the decoder and environment map in the same mode', () => {
		for (const href of [
			'/draco/draco_wasm_wrapper.js',
			'/draco/draco_decoder.wasm',
			'https://storage.googleapis.com/environment-maps/studio/studio_natural_1k.hdr'
		]) {
			expect(head).toMatch(
				new RegExp(
					`<link rel="preload" href="${href}" as="fetch" crossorigin=""`
				)
			)
		}
		expect(head).toContain(
			'<link rel="preconnect" href="https://storage.googleapis.com" crossorigin=""/>'
		)
	})
})
