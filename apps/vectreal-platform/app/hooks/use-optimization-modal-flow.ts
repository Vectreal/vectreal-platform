import { useAtom } from 'jotai/react'
import { useCallback, useMemo } from 'react'

import { optimizationModalAtom } from '../lib/stores/scene-optimization-store'

import type { SaveAvailabilityState } from '../lib/domain/scene'

interface UseOptimizationModalFlowArgs {
	saveAvailability: SaveAvailabilityState
	hasUnsavedLocationChange: boolean
}

type UseOptimizationDrawerFlowArgs = UseOptimizationModalFlowArgs

/**
 * Centralizes optimization-modal behavior and first-save optimization gating.
 *
 * This keeps controls/publisher UI components focused on rendering while the
 * hook owns modal orchestration side effects.
 */
export function useOptimizationDrawerFlow({
	saveAvailability,
	hasUnsavedLocationChange
}: UseOptimizationDrawerFlowArgs) {
	const [optimizationDrawer, setOptimizationDrawer] = useAtom(
		optimizationModalAtom
	)

	const effectiveSaveAvailability = useMemo(
		() =>
			saveAvailability.reason === 'no-unsaved-changes' &&
			hasUnsavedLocationChange
				? {
						...saveAvailability,
						canSave: true,
						reason: 'ready' as const
					}
				: saveAvailability,
		[saveAvailability, hasUnsavedLocationChange]
	)

	const isInitialOptimizationRequired = false

	const handleOptimizationDrawerChange = useCallback(
		(open: boolean) => {
			setOptimizationDrawer((prev) => ({
				...prev,
				isOpen: open,
				source: open ? prev.source : null
			}))
		},
		[setOptimizationDrawer]
	)

	const openReoptimizeDrawer = useCallback(() => {
		setOptimizationDrawer({ isOpen: true, source: 'reoptimize' })
	}, [setOptimizationDrawer])

	const handleOpenOptimizationDrawer = useCallback(() => {
		setOptimizationDrawer((prev) => ({
			isOpen: true,
			source: prev.source ?? 'reoptimize'
		}))
	}, [setOptimizationDrawer])

	return {
		effectiveSaveAvailability,
		isInitialOptimizationRequired,
		isOptimizationDrawerOpen: optimizationDrawer.isOpen,
		handleOptimizationDrawerChange,
		handleOpenOptimizationDrawer,
		openReoptimizeDrawer,
		isOptimizationModalOpen: optimizationDrawer.isOpen,
		handleOptimizationModalChange: handleOptimizationDrawerChange,
		handleOpenOptimizationModal: handleOpenOptimizationDrawer,
		openReoptimizeModal: openReoptimizeDrawer
	}
}

export const useOptimizationModalFlow = useOptimizationDrawerFlow
