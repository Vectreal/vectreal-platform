import { useSyncExternalStore } from 'react'

import { HERO_MODEL } from '../../../lib/samples/sample-models'

import type { HOME_PAGE_COPY } from '../../../constants/product-copy'

export type HeroStatus = keyof typeof HOME_PAGE_COPY.stage.status

/** What the readout says about the model on the stage. */
export interface HeroReadout {
	fileName: string
	materials: number
	vertices: number
	textures: number
	/** The size before optimization, when there is one to compare against. */
	originalBytes: number | null
	bytes: number
}

export interface HeroState {
	status: HeroStatus
	/** Orange dot: something is in progress. */
	busy: boolean
	readout: HeroReadout
	/** Bytes shown so far while the model downloads; equals `readout.bytes` once it has. */
	shownBytes: number
	/** Whose face the figure label names: the hero model's, a dropped file's, or the live object. */
	view: 'hero' | 'dropped' | 'live'
	/** A dropped file on the stage can be handed to the publisher. */
	canHandOff: boolean
}

export const HERO_INITIAL_STATE: HeroState = {
	status: 'loading',
	busy: true,
	readout: {
		fileName: HERO_MODEL.fileName,
		...HERO_MODEL.contents,
		originalBytes: HERO_MODEL.sourceBytes,
		bytes: HERO_MODEL.bytes
	},
	shownBytes: 0,
	view: 'hero',
	canHandOff: false
}

/**
 * The hero's state, shared between the server-rendered sheet and the stage that
 * mounts into it later.
 *
 * A store rather than component state because the download counter updates
 * every frame for as long as the model takes to arrive: only the readout cells
 * that read a changed slice re-render, not the headline and the stage beside
 * them.
 */
export interface HeroStore {
	get: () => HeroState
	set: (patch: Partial<HeroState>) => void
	subscribe: (listener: () => void) => () => void
}

export function createHeroStore(): HeroStore {
	let state = HERO_INITIAL_STATE
	const listeners = new Set<() => void>()
	return {
		get: () => state,
		set: (patch) => {
			state = { ...state, ...patch }
			for (const listener of listeners) listener()
		},
		subscribe: (listener) => {
			listeners.add(listener)
			return () => listeners.delete(listener)
		}
	}
}

export function useHeroState<T>(
	store: HeroStore,
	select: (s: HeroState) => T
): T {
	return useSyncExternalStore(
		store.subscribe,
		() => select(store.get()),
		() => select(HERO_INITIAL_STATE)
	)
}
