// @vitest-environment jsdom
/**
 * A saved animation config follows the clips the loaded model actually has,
 * and a scene nobody animated is left exactly as it was.
 */
import { act, renderHook } from '@testing-library/react'
import { describeAnimationClips } from '@vctrl/core'
import { createStore, Provider } from 'jotai'
import { AnimationClip } from 'three'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAnimationReconciliation } from './use-animation-reconciliation'
import { resolveAnimationDraft } from '../../../../../lib/domain/scene/scene-animation-draft'
import { lastSavedSettingsAtom } from '../../../../../lib/stores/publisher-config-store'
import {
	animationAtom,
	animationDriftAtom
} from '../../../../../lib/stores/scene-settings-store'

import type { ReactNode } from 'react'

const model = vi.hoisted(() => ({
	file: null as null | { animations: AnimationClip[] }
}))

vi.mock('@vctrl/hooks/use-load-model', () => ({
	useModelContext: () => ({ file: model.file })
}))

const walkAndRun = () => [
	new AnimationClip('Walk', 1.2, []),
	new AnimationClip('Run', 0.8, [])
]

const runHook = (store: ReturnType<typeof createStore>) =>
	renderHook(() => useAnimationReconciliation(), {
		wrapper: ({ children }: { children: ReactNode }) => (
			<Provider store={store}>{children}</Provider>
		)
	})

/** A config saved against Walk and Run, with animation on. */
const savedAgainstWalkAndRun = () => ({
	...resolveAnimationDraft(undefined, walkAndRun()).settings,
	enabled: true
})

beforeEach(() => {
	model.file = null
})

describe('useAnimationReconciliation', () => {
	it('leaves a scene with nothing saved alone', () => {
		model.file = { animations: walkAndRun() }
		const store = createStore()

		runHook(store)

		expect(store.get(animationAtom)).toBeUndefined()
		expect(store.get(animationDriftAtom)).toBeNull()
	})

	it('leaves a saved config that matches the model alone', () => {
		model.file = { animations: walkAndRun() }
		const store = createStore()
		const saved = savedAgainstWalkAndRun()
		store.set(animationAtom, saved)

		runHook(store)

		expect(store.get(animationAtom)).toBe(saved)
		expect(store.get(animationDriftAtom)).toBeNull()
	})

	it('waits for the model before judging the saved config', () => {
		const store = createStore()
		const saved = savedAgainstWalkAndRun()
		store.set(animationAtom, saved)

		runHook(store)

		expect(store.get(animationAtom)).toBe(saved)
	})

	it('re-points a config at a model whose clips changed, and says what changed', () => {
		const [walk] = walkAndRun()
		const jump = new AnimationClip('Jump', 2, [])
		model.file = { animations: [walk, jump] }
		const store = createStore()
		store.set(animationAtom, savedAgainstWalkAndRun())

		runHook(store)

		const [jumpId] = describeAnimationClips([walk, jump])
			.filter((clip) => clip.name === 'Jump')
			.map((clip) => clip.clipId)
		expect(
			store.get(animationAtom)?.clips.map((clip) => clip.sourceName)
		).toEqual(['Walk', 'Jump'])
		expect(store.get(animationAtom)?.enabled).toBe(true)
		const drift = store.get(animationDriftAtom)
		// Run sat at index 1, so its tuning is re-attached to Jump by position.
		expect(drift?.remapped.map((entry) => entry.clipId)).toEqual([jumpId])
	})

	it('drops the report once it is saved, and a later edit does not bring it back', () => {
		const [walk] = walkAndRun()
		model.file = { animations: [walk, new AnimationClip('Jump', 2, [])] }
		const store = createStore()
		const saved = savedAgainstWalkAndRun()
		store.set(animationAtom, saved)
		store.set(lastSavedSettingsAtom, { animation: saved })

		runHook(store)
		expect(store.get(animationDriftAtom)).not.toBeNull()

		// What a save does: the current settings become the baseline.
		const reconciled = store.get(animationAtom)
		act(() => store.set(lastSavedSettingsAtom, { animation: reconciled }))
		expect(store.get(animationDriftAtom)).toBeNull()

		act(() =>
			store.set(animationAtom, reconciled && { ...reconciled, autoplay: false })
		)
		expect(store.get(animationDriftAtom)).toBeNull()
	})
})
