import { describe, expect, it } from 'vitest'

import { chooseSceneManifestKind } from './scene-manifest-kind'

describe('chooseSceneManifestKind', () => {
	it('serves the published artefact to a key holder', () => {
		expect(
			chooseSceneManifestKind({ hasPublication: true, caller: 'apiKey' })
		).toBe('embed')
	})

	it('serves the published artefact to a signed-in member too', () => {
		expect(
			chooseSceneManifestKind({ hasPublication: true, caller: 'session' })
		).toBe('embed')
	})

	it('serves a draft to a signed-in member as the working scene', () => {
		expect(
			chooseSceneManifestKind({ hasPublication: false, caller: 'session' })
		).toBe('working')
	})

	it('serves a key holder nothing for a draft', () => {
		expect(
			chooseSceneManifestKind({ hasPublication: false, caller: 'apiKey' })
		).toBe('not-found')
	})
})
