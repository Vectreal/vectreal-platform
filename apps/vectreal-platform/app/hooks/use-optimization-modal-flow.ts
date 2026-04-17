import { useAtom } from 'jotai/react'
import { useCallback, useEffect, useMemo } from 'react'

import { optimizationModalAtom } from '../lib/stores/scene-optimization-store'

import type { SaveAvailabilityState } from '../lib/domain/scene'

interface UseOptimizationModalFlowArgs {
	saveAvailability: SaveAvailabilityState
	hasUnsavedLocationChange: boolean
}

/**
 * Centralizes optimization-modal behavior and first-save optimization gating.
 *
 * This keeps controls/publisher UI components focused on rendering while the
 * hook owns modal orchestration side effects.
 */
export function useOptimizationModalFlow({
	saveAvailability,
	hasUnsavedLocationChange
}: UseOptimizationModalFlowArgs) {
	const [optimizationModal, setOptimizationModal] = useAtom(
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

	const isInitialOptimizationRequired =
		effectiveSaveAvailability.reason === 'requires-first-optimization'

	useEffect(() => {
		if (!isInitialOptimizationRequired || optimizationModal.isOpen) {
			return
		}

		setOptimizationModal({
			isOpen: true,
			source: 'initial'
		})
	}, [
		isInitialOptimizationRequired,
		optimizationModal.isOpen,
		setOptimizationModal
	])

	const handleOptimizationModalChange = useCallback(
		(open: boolean) => {
			if (!open && isInitialOptimizationRequired) {
				return
			}

			setOptimizationModal((prev) => ({
				...prev,
				isOpen: open,
				source: open ? prev.source : null
			}))
		},
		[isInitialOptimizationRequired, setOptimizationModal]
	)

	const openReoptimizeModal = useCallback(() => {
		setOptimizationModal({ isOpen: true, source: 'reoptimize' })
	}, [setOptimizationModal])

	const handleOpenOptimizationModal = useCallback(() => {
		setOptimizationModal((prev) => ({
			isOpen: true,
			source: prev.source ?? 'reoptimize'
		}))
	}, [setOptimizationModal])

	return {
		effectiveSaveAvailability,
		isInitialOptimizationRequired,
		isOptimizationModalOpen: optimizationModal.isOpen,
		handleOptimizationModalChange,
		handleOpenOptimizationModal,
		openReoptimizeModal
	}
}
