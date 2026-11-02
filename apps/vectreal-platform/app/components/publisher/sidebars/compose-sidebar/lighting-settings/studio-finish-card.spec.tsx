// @vitest-environment jsdom
/**
 * The studio finish is one surface reached from the Lighting tool's root: its
 * card says where it stands, and adding it turns on what the lighting can
 * draw in.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { LIGHTING_SETUPS } from '@vctrl/core'
import { ModelProvider } from '@vctrl/hooks/use-load-model'
import { createStore, Provider } from 'jotai'
import { describe, expect, it } from 'vitest'

import LightingSettings from './lighting-settings-panel'
import { finishStatus, StudioFinishCard } from './studio-finish-card'
import {
	BAKE_SKIP_REASONS,
	topSkipCaption
} from '../../../../../lib/domain/scene/client/studio-finish-reasons'
import { lightingAtom } from '../../../../../lib/stores/scene-settings-store'
import { DrillDown, DrillDownView } from '../../drill-down'

import type { BakePreview } from '../../../../../lib/stores/publisher-config-store'
import type { LightingSettings as Lighting } from '@vctrl/core'

// The sliders and the globe measure themselves; jsdom has no ResizeObserver.
globalThis.ResizeObserver ??= class {
	observe() {}
	unobserve() {}
	disconnect() {}
}

const SOURCE = { document: null, passRevision: 0, bakes: '' }
const ready = (shown: boolean, baked: string[]): BakePreview => ({
	status: 'ready',
	source: SOURCE,
	shown,
	reports: { occlusion: { baked, skipped: [] } }
})

describe('finishStatus', () => {
	it('follows the lighting, then the preview', () => {
		expect(finishStatus(false, null)).toBe('off')
		expect(finishStatus(true, null)).toBe('on')
		expect(
			finishStatus(true, { status: 'baking', source: SOURCE, shown: true })
		).toBe('drawing')
		expect(
			finishStatus(true, {
				status: 'failed',
				source: SOURCE,
				shown: true,
				failure: { reason: 'unexpected', detail: 'x' }
			})
		).toBe('failed')
		expect(finishStatus(true, ready(true, ['Body']))).toBe('applied')
		expect(finishStatus(true, ready(false, ['Body']))).toBe('compare')
		expect(finishStatus(true, ready(true, []))).toBe('nothing')
	})
})

const renderPanel = (lighting: Lighting) => {
	const store = createStore()
	store.set(lightingAtom, lighting)
	render(
		<Provider store={store}>
			<ModelProvider>
				<LightingSettings />
			</ModelProvider>
		</Provider>
	)
	return store
}

const product = LIGHTING_SETUPS.find((setup) => setup.id === 'product')!
const overcast = LIGHTING_SETUPS.find((setup) => setup.id === 'overcast')!

describe('adding the studio finish', () => {
	it('draws in depth and the studio lights', () => {
		const store = renderPanel(product.lighting)
		fireEvent.click(screen.getByRole('button', { name: 'Add studio finish' }))
		const lighting = store.get(lightingAtom)
		expect(lighting.occlusion?.mode).toBe('baked')
		expect(lighting.bake?.lights).toBe(true)
		expect(screen.queryByRole('button', { name: 'Add studio finish' })).toBe(
			null
		)
	})

	it('leaves the lights out when there are none to draw', () => {
		const store = renderPanel(overcast.lighting)
		fireEvent.click(screen.getByRole('button', { name: 'Add studio finish' }))
		expect(store.get(lightingAtom).occlusion?.mode).toBe('baked')
		expect(store.get(lightingAtom).bake?.lights).toBe(false)
	})

	it('replaces the separate occlusion and bake views', () => {
		renderPanel(product.lighting)
		expect(screen.queryByRole('button', { name: /Ambient occlusion/ })).toBe(
			null
		)
		expect(screen.queryByRole('button', { name: /^Bake/ })).toBe(null)
	})
})

describe('the card when nothing took the finish', () => {
	const renderCard = (nothingCaption?: string) =>
		render(
			<DrillDown path={[]} onPathChange={() => {}} rootTitle="Lighting">
				<DrillDownView id="root">
					<StudioFinishCard
						status="nothing"
						nothingCaption={nothingCaption}
						canPreview
						isOptimizing={false}
						onAdd={() => {}}
						onPreview={() => {}}
						onShownChange={() => {}}
					/>
				</DrillDownView>
			</DrillDown>
		)

	it('says why in one line', () => {
		const caption = topSkipCaption({
			occlusion: {
				baked: [],
				skipped: [
					{ material: 'Body', reason: 'no-uv0' },
					{ material: 'Sole', reason: 'no-uv0' }
				]
			}
		})
		renderCard(caption)

		expect(
			screen.getByText(`2 materials: ${BAKE_SKIP_REASONS['no-uv0']}`)
		).toBeTruthy()
	})

	it('adds no line when there is no reason to give', () => {
		const { container } = renderCard(undefined)
		const captions = container.querySelectorAll('p')

		expect([...captions].map((p) => p.textContent)).toEqual([
			'Soft shadows and depth, drawn into the model once, so every view shows them at no cost.'
		])
	})
})
