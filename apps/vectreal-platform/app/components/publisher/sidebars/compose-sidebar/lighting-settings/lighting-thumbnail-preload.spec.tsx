// @vitest-environment jsdom
/**
 * Opening the Lighting panel asks for every thumbnail it can show, the
 * Environment view's among them, before that view mounts.
 */
import { render } from '@testing-library/react'
import { ENVIRONMENT_KEYS, LIGHTING_SETUPS } from '@vctrl/core'
import { ModelProvider } from '@vctrl/hooks/use-load-model'
import { createStore, Provider } from 'jotai'
import { describe, expect, it, vi } from 'vitest'

import LightingSettings from './lighting-settings-panel'
import {
	environmentThumbnail,
	lightingSetupThumbnail
} from '../../../../../lib/lighting/lighting-thumbnails'

vi.mock('./use-bake-preview', async (original) => ({
	...(await original<typeof import('./use-bake-preview')>()),
	useBakePreview: () => ({
		preview: null,
		canBake: false,
		bakesAnything: false,
		isOptimizing: false,
		isAnimated: false,
		bake: () => {},
		setShown: () => {}
	})
}))

globalThis.ResizeObserver ??= class {
	observe() {}
	unobserve() {}
	disconnect() {}
}

describe('the Lighting panel', () => {
	it('preloads every setup and environment thumbnail as it opens', () => {
		render(
			<Provider store={createStore()}>
				<ModelProvider>
					<LightingSettings />
				</ModelProvider>
			</Provider>
		)

		const preloaded = [
			...document.head.querySelectorAll<HTMLLinkElement>(
				'link[rel="preload"][as="image"]'
			)
		].map((link) => link.getAttribute('href'))

		expect(preloaded).toEqual(
			expect.arrayContaining([
				...LIGHTING_SETUPS.map(({ id }) => lightingSetupThumbnail(id)),
				...ENVIRONMENT_KEYS.map(environmentThumbnail)
			])
		)
		// The Environment view is not open, so only the preload can have asked.
		expect(
			document.querySelector(`img[src="${environmentThumbnail('night-city')}"]`)
		).toBeNull()
	})
})
