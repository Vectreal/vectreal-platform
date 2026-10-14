/**
 * The settings a save persists must describe the document it uploads. These
 * pin the three places that decide them without a pass: choosing the original,
 * reopening a saved scene, and restoring a draft.
 */
import { resolveDerivedSettings } from './optimization-inference'
import { inferOptimizationPreset } from './optimization-inference'
import { resolveRestoredDraftOptimization } from './scene-draft-persistence'
import { executeOptimizationStateHydration } from './scene-optimization-hydration'
import {
	balancedPreset,
	originalPreset,
	smallestPreset
} from '../../../../constants/optimizations'
import {
	optimizationInitialState,
	optimizationRuntimeInitialState
} from '../../../stores/scene-optimization-store'

import type { SceneManifestResponse } from '../../../../types/api'
import type {
	OptimizationState,
	SceneOptimizationRuntimeState
} from '../../../../types/scene-optimization'
import type { Optimizations } from '@vctrl/core'

describe('resolveDerivedSettings', () => {
	it('describes a pass that ran nothing by its source', () => {
		expect(resolveDerivedSettings(originalPreset, smallestPreset)).toBe(
			smallestPreset
		)
	})

	it('describes any other pass by its own settings', () => {
		expect(resolveDerivedSettings(balancedPreset, smallestPreset)).toBe(
			balancedPreset
		)
	})
})

function hydrate(stats: {
	optimizationSettings: Optimizations
	appliedOptimizations: string[]
}): OptimizationState {
	let state = optimizationInitialState
	executeOptimizationStateHydration({
		manifest: { stats } as unknown as SceneManifestResponse,
		calculateManifestReferencedBytes: () => ({
			sourcePackageBytes: null,
			textureBytes: null
		}),
		inferOptimizationPreset,
		setOptimizationState: (update) => {
			state = update(state)
		},
		setOptimizationRuntime: () => {},
		optimizationRuntimeInitialState,
		defaultOptimizations: balancedPreset
	})
	return state
}

describe('hydrating a saved scene', () => {
	it('treats a scene saved optimized as its own source', () => {
		const state = hydrate({
			optimizationSettings: smallestPreset,
			appliedOptimizations: ['texture compression']
		})

		expect(state.sourceSettings).toBe(smallestPreset)
		expect(state.derivedFrom).toBe(smallestPreset)
	})

	it('treats a scene saved as the original as the untouched upload', () => {
		const state = hydrate({
			optimizationSettings: originalPreset,
			appliedOptimizations: []
		})

		expect(state.sourceSettings).toBe(originalPreset)
		expect(state.derivedFrom).toBe(originalPreset)
	})

	// Choosing "Saved version" re-runs no step, so the applied-steps list a
	// save stores comes back empty while the textures are still the lossy ones.
	// The settings, not that list, say what the document is.
	it('keeps a saved version saved even when no step is recorded', () => {
		const state = hydrate({
			optimizationSettings: smallestPreset,
			appliedOptimizations: []
		})

		expect(state.sourceSettings).toBe(smallestPreset)
		expect(state.derivedFrom).toBe(smallestPreset)
	})
})

describe('resolveRestoredDraftOptimization', () => {
	it('starts presets from the original a draft carries', () => {
		expect(
			resolveRestoredDraftOptimization({
				optimizationSettings: smallestPreset,
				sourceGlb: new Uint8Array([1])
			})
		).toEqual({ sourceSettings: originalPreset, derivedFrom: smallestPreset })
	})

	it('treats an older draft without its original as its own source', () => {
		expect(
			resolveRestoredDraftOptimization({
				optimizationSettings: smallestPreset,
				sourceGlb: null
			})
		).toEqual({ sourceSettings: smallestPreset, derivedFrom: smallestPreset })
	})

	it('treats a draft without settings as the original', () => {
		expect(
			resolveRestoredDraftOptimization({
				optimizationSettings: null,
				sourceGlb: null
			})
		).toEqual({ sourceSettings: originalPreset, derivedFrom: originalPreset })
	})

	// A session that expires on a reopened saved version hands its saved
	// document over as the source; it must not come back as "original".
	it('keeps what the draft says its source embodies', () => {
		expect(
			resolveRestoredDraftOptimization({
				optimizationSettings: balancedPreset,
				sourceGlb: new Uint8Array([1]),
				sourceSettings: smallestPreset
			})
		).toEqual({ sourceSettings: smallestPreset, derivedFrom: balancedPreset })
	})

	// Opening a scene makes its document the saved one, whatever passes the
	// previous scene ran, so nothing reads as unsaved until a pass runs on it.
	it('counts a scene it opens as saved as of the latest pass', () => {
		let runtime: SceneOptimizationRuntimeState = {
			...optimizationRuntimeInitialState,
			passRevision: 5
		}
		executeOptimizationStateHydration({
			manifest: {
				stats: {
					optimizationSettings: balancedPreset,
					appliedOptimizations: []
				}
			} as unknown as SceneManifestResponse,
			calculateManifestReferencedBytes: () => ({
				sourcePackageBytes: null,
				textureBytes: null
			}),
			inferOptimizationPreset,
			setOptimizationState: () => {},
			setOptimizationRuntime: (update) => {
				runtime = typeof update === 'function' ? update(runtime) : update
			},
			optimizationRuntimeInitialState,
			defaultOptimizations: balancedPreset
		})

		expect(runtime.savedPassRevision).toBe(5)
	})
})

it('counts a scene it opens without saved stats as saved too', () => {
	let runtime: SceneOptimizationRuntimeState = {
		...optimizationRuntimeInitialState,
		passRevision: 5
	}
	executeOptimizationStateHydration({
		manifest: { stats: null } as unknown as SceneManifestResponse,
		calculateManifestReferencedBytes: () => ({
			sourcePackageBytes: null,
			textureBytes: null
		}),
		inferOptimizationPreset,
		setOptimizationState: () => {},
		setOptimizationRuntime: (update) => {
			runtime = typeof update === 'function' ? update(runtime) : update
		},
		optimizationRuntimeInitialState,
		defaultOptimizations: balancedPreset
	})

	expect(runtime.savedPassRevision).toBe(runtime.passRevision)
})

// A scene this tab just saved: its save recorded the pass it stored, and a
// pass that finished during the save must not be counted as stored too.
it('keeps what the save recorded when it hydrates a scene this tab saved', () => {
	let runtime: SceneOptimizationRuntimeState = {
		...optimizationRuntimeInitialState,
		passRevision: 5,
		savedPassRevision: 3
	}
	executeOptimizationStateHydration({
		manifest: {
			stats: { optimizationSettings: balancedPreset, appliedOptimizations: [] }
		} as unknown as SceneManifestResponse,
		calculateManifestReferencedBytes: () => ({
			sourcePackageBytes: null,
			textureBytes: null
		}),
		inferOptimizationPreset,
		setOptimizationState: () => {},
		setOptimizationRuntime: (update) => {
			runtime = typeof update === 'function' ? update(runtime) : update
		},
		optimizationRuntimeInitialState,
		defaultOptimizations: balancedPreset,
		isSourceLoaded: true
	})

	expect(runtime.savedPassRevision).toBe(3)
})

// What a pass measured describes the document it ran on, which only a scene
// this tab just saved still has loaded.
describe('measured sizes on hydration', () => {
	const measured: SceneOptimizationRuntimeState = {
		...optimizationRuntimeInitialState,
		optimizedSceneBytes: 861,
		optimizedTextureBytes: 772,
		workingSceneBytes: 1400
	}

	const hydrate = (isSourceLoaded: boolean) => {
		let runtime = measured
		executeOptimizationStateHydration({
			manifest: {
				stats: {
					optimizationSettings: balancedPreset,
					appliedOptimizations: []
				}
			} as unknown as SceneManifestResponse,
			calculateManifestReferencedBytes: () => ({
				sourcePackageBytes: 1400,
				textureBytes: null
			}),
			inferOptimizationPreset,
			setOptimizationState: () => {},
			setOptimizationRuntime: (update) => {
				runtime = typeof update === 'function' ? update(runtime) : update
			},
			optimizationRuntimeInitialState,
			defaultOptimizations: balancedPreset,
			isSourceLoaded
		})
		return runtime
	}

	it('keeps them for a scene this tab just saved', () => {
		expect(hydrate(true)).toMatchObject({
			optimizedSceneBytes: 861,
			optimizedTextureBytes: 772,
			workingSceneBytes: 1400
		})
	})

	it('drops them for a scene it opens', () => {
		expect(hydrate(false)).toMatchObject({
			optimizedSceneBytes: null,
			optimizedTextureBytes: null,
			workingSceneBytes: null
		})
	})
})
