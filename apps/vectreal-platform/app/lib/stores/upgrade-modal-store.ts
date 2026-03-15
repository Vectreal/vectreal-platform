import { atom } from 'jotai'
import { createStore } from 'jotai/vanilla'

import type { Plan } from '../../constants/plan-config'

export type UpgradeModalDenialReason =
	| 'quota_exceeded'
	| 'feature_not_available'
	| 'plan_inactive'

export interface UpgradeModalState {
	open: boolean
	/** Why the user is seeing the upgrade prompt */
	reason: UpgradeModalDenialReason
	/** Human-readable context about what was blocked */
	message: string
	/** The limit key that was exceeded, if applicable */
	limitKey?: string
	/** Current usage value */
	currentValue?: number
	/** The hard quota limit */
	limit?: number | null
	/** The effective plan at the time of denial */
	plan?: Plan
	/** The recommended upgrade target */
	upgradeTo?: Plan | null
	/** Which action was being attempted (for analytics) */
	actionAttempted?: string
}

export const DEFAULT_UPGRADE_MODAL_STATE: UpgradeModalState = {
	open: false,
	reason: 'quota_exceeded',
	message: 'You have reached your plan limit.'
}

export const upgradeModalAtom = atom<UpgradeModalState>(
	DEFAULT_UPGRADE_MODAL_STATE
)

export const upgradeModalStore = createStore()

upgradeModalStore.set(upgradeModalAtom, DEFAULT_UPGRADE_MODAL_STATE)

export function buildUpgradeModalState(
	overrides: Partial<Omit<UpgradeModalState, 'open'>>
): UpgradeModalState {
	return { ...DEFAULT_UPGRADE_MODAL_STATE, open: true, ...overrides }
}

export function closeUpgradeModalState(
	state: UpgradeModalState
): UpgradeModalState {
	return { ...state, open: false }
}
