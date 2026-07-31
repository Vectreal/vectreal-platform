import { useMemo, useState } from 'react'

export interface OptimizationStepsState {
	/** The step currently running, or null between steps. */
	current: string | null
	completed: string[]
	/** Every row the checklist will show, known before the first step starts. */
	allSteps: string[]
}

/**
 * Imperative handle over the checklist. Every method is stable for the lifetime
 * of the hook, so the pass orchestration can take this as a plain dependency
 * without dragging React state into its signature.
 */
export interface OptimizationStepsController {
	/** Seeds the full checklist and marks the first row as running. */
	plan: (allSteps: string[], firstStep: string) => void
	begin: (step: string) => void
	/** Idempotent — a step reports completion from more than one place. */
	complete: (step: string) => void
	/**
	 * Marks everything done. The last stretch of a pass has no step of its own,
	 * and without this the checklist freezes mid-way as the panel closes.
	 */
	settleAll: () => void
	reset: () => void
}

const EMPTY_STATE: OptimizationStepsState = {
	current: null,
	completed: [],
	allSteps: []
}

export function useOptimizationSteps(): {
	steps: OptimizationStepsState
	controller: OptimizationStepsController
} {
	const [steps, setSteps] = useState<OptimizationStepsState>(EMPTY_STATE)

	const controller = useMemo<OptimizationStepsController>(
		() => ({
			plan: (allSteps, firstStep) =>
				setSteps({ current: firstStep, completed: [], allSteps }),
			begin: (step) => setSteps((prev) => ({ ...prev, current: step })),
			complete: (step) =>
				setSteps((prev) =>
					prev.completed.includes(step)
						? prev
						: { ...prev, completed: [...prev.completed, step] }
				),
			settleAll: () =>
				setSteps((prev) => ({
					...prev,
					current: null,
					completed: prev.allSteps
				})),
			reset: () => setSteps(EMPTY_STATE)
		}),
		[]
	)

	return { steps, controller }
}
