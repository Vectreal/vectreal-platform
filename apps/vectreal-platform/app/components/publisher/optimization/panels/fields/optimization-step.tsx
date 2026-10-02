import { Toggle } from '@shared/components/ui/toggle'

import { InfoTooltip } from '../../../../info-tooltip'
import { getOptimizationDefinition, type OptimizationKey } from '../../model'

import type { ReactNode } from 'react'

interface StepToggleProps {
	step: OptimizationKey
	checked: boolean
	onCheckedChange: (checked: boolean) => void
	/** Marks the step before its title, such as the destructive step's warning. */
	icon?: ReactNode
	/** Replaces the step's own description where the context changes it. */
	description?: ReactNode
}

/**
 * Switches one optimization step, named and explained by its catalog entry so
 * the copy lives in one place. The tooltip carries the longer reasoning.
 */
export function StepToggle({
	step,
	checked,
	onCheckedChange,
	icon,
	description
}: StepToggleProps) {
	const definition = getOptimizationDefinition(step)
	return (
		<Toggle
			checked={checked}
			onCheckedChange={onCheckedChange}
			label={
				icon ? (
					<span className="inline-flex items-center gap-2">
						{icon}
						{definition.title}
					</span>
				) : (
					definition.title
				)
			}
			description={
				<>
					{description ?? definition.description}{' '}
					<InfoTooltip content={definition.tooltip} />
				</>
			}
		/>
	)
}

/**
 * One block per step in the optimization drawer: its switch first, then its
 * settings while it is on. Flat and unbordered, a tint on the drawer like
 * every nested block in the publisher, so no step sits on a card inside a card.
 */
export function StepBlock({ children }: { children: ReactNode }) {
	return (
		<div className="publisher-shell-nested space-y-4 rounded-xl p-4">
			{children}
		</div>
	)
}
