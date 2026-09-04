// @vitest-environment jsdom
/**
 * Applying settings and adopting them as the saved baseline are two different
 * things, and only one caller wants both.
 *
 * A scene loaded from its route manifest is the saved state, so it becomes the
 * baseline the unsaved-changes check diffs against. A draft restored from this
 * browser has never been saved: `hasUnsavedChanges` treats a null baseline as
 * "never saved, so everything is unsaved", and writing one makes a scene with no
 * server row report nothing to save - the Save button goes dead on the exact
 * flow the draft feature exists for.
 */
import { renderHook } from '@testing-library/react'
import { createStore, Provider } from 'jotai'
import { describe, expect, it } from 'vitest'

import { useApplySceneSettings } from './use-scene-settings'
import { lastSavedSettingsAtom } from '../../lib/stores/publisher-config-store'
import { hotspotsAtom } from '../../lib/stores/scene-settings-store'

import type { HotspotDefinition, SceneSettings } from '@vctrl/core'
import type { ReactNode } from 'react'

const hotspot: HotspotDefinition = {
	id: '00000000-0000-4000-8000-000000000001',
	name: 'Nose cone',
	worldPosition: [1, 2, 3],
	visible: true,
	internalOnly: false,
	stylePreset: 'dot'
}

const settings = { hotspots: [hotspot] } as SceneSettings

const arrange = () => {
	const store = createStore()
	const wrapper = ({ children }: { children: ReactNode }) => (
		<Provider store={store}>{children}</Provider>
	)
	const { result } = renderHook(() => useApplySceneSettings(), { wrapper })
	return { store, apply: result.current }
}

describe('useApplySceneSettings', () => {
	it('puts the settings into the atoms either way', () => {
		const { store, apply } = arrange()

		apply(settings, { isSavedBaseline: false })

		expect(store.get(hotspotsAtom)).toEqual([hotspot])
	})

	it('adopts a manifest load as the baseline', () => {
		const { store, apply } = arrange()

		apply(settings, { isSavedBaseline: true })

		expect(store.get(lastSavedSettingsAtom)).not.toBeNull()
	})

	it('leaves a restored draft with no baseline, so it still reads unsaved', () => {
		const { store, apply } = arrange()

		apply(settings, { isSavedBaseline: false })

		expect(store.get(lastSavedSettingsAtom)).toBeNull()
	})
})
