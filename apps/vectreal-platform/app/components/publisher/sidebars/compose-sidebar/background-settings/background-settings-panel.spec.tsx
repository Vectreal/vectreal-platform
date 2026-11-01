// @vitest-environment jsdom
/**
 * The Background tool edits the background stored with the lighting, and it
 * is a tool of its own: the Lighting tool no longer carries it.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { fireEvent, render, screen } from '@testing-library/react'
import { createStore, Provider } from 'jotai'
import { describe, expect, it } from 'vitest'

import BackgroundSettings from './background-settings-panel'
import { lightingAtom } from '../../../../../lib/stores/scene-settings-store'
import { COMPOSE_TOOL_DEFINITIONS } from '../compose-tools'

// The sliders measure themselves; jsdom has no ResizeObserver.
globalThis.ResizeObserver ??= class {
	observe() {}
	unobserve() {}
	disconnect() {}
}

const renderPanel = () => {
	const store = createStore()
	render(
		<Provider store={store}>
			<BackgroundSettings />
		</Provider>
	)
	return store
}

describe('the Background tool', () => {
	it('is a tool of its own, after Lighting', () => {
		const tools = COMPOSE_TOOL_DEFINITIONS.map((tool) => tool.value)
		expect(tools.indexOf('background')).toBe(tools.indexOf('lighting') + 1)
		expect(
			COMPOSE_TOOL_DEFINITIONS.find((tool) => tool.value === 'background')
				?.component
		).toBe(BackgroundSettings)
	})

	it('writes the background into the lighting at once', () => {
		const store = renderPanel()
		fireEvent.click(screen.getByRole('radio', { name: 'Color' }))
		expect(store.get(lightingAtom).background?.type).toBe('color')
		expect(screen.getByText(/A flat stage behind the model/)).toBeTruthy()
	})

	it('is gone from the Lighting tool', () => {
		const lighting = readFileSync(
			join(
				import.meta.dirname,
				'../lighting-settings/lighting-settings-panel.tsx'
			),
			'utf8'
		)
		expect(lighting).not.toMatch(/to="background"|id="background"/)
	})
})
