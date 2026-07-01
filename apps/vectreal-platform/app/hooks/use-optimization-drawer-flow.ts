import { useAtom } from 'jotai/react'
import { useCallback, useEffect, useMemo, useRef } from 'react'

import { optimizationModalAtom } from '../lib/stores/scene-optimization-store'

import type { SaveAvailabilityState } from '../lib/domain/scene'

interface UseOptimizationDrawerFlowArgs {
	saveAvailability: SaveAvailabilityState
	hasUnsavedLocationChange: boolean
}

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

	const requiresSizeReduction =
		effectiveSaveAvailability.reason === 'requires-size-reduction'

	// Pre-open the optimizer once per over-limit episode. Soft-gate: if the user
	// closes it while still over the limit, we do not force it back open; the ref
	// resets only when the scene drops back under the limit.
	const hasAutoOpenedForSizeRef = useRef(false)

	useEffect(() => {
		if (!requiresSizeReduction) {
			hasAutoOpenedForSizeRef.current = false
			return
		}

		if (optimizationDrawer.isOpen || hasAutoOpenedForSizeRef.current) {
			return
		}

		hasAutoOpenedForSizeRef.current = true
		setOptimizationDrawer({
			isOpen: true,
			source: 'initial'
		})
	}, [requiresSizeReduction, optimizationDrawer.isOpen, setOptimizationDrawer])

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
		requiresSizeReduction,
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
