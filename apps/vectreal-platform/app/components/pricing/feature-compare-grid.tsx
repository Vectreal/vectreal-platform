/**
 * FeatureCompareGrid
 * Full feature comparison table across all four plans.
 * Extracted from pricing-page.tsx so it can be reused on the upgrade route.
 */

import { cn } from '@shared/utils'
import { Check, Minus } from 'lucide-react'
import React from 'react'

import { PLAN_ENTITLEMENTS, type Plan } from '../../constants/plan-config'
import {
	ENTITLEMENT_FEATURE_GROUPS,
	PLAN_DISPLAY_NAMES,
	PLAN_HIGHLIGHTED
} from '../../constants/product-copy'

const PLANS: Plan[] = ['free', 'pro', 'business', 'enterprise']

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/*
  The word carries the meaning; the glyph decorates it.

  Lucide marks an icon with no children aria-hidden, so a cell holding nothing
  but a Check announced as empty - the whole matrix read as blank cells, and
  granted was distinguishable only by shape and colour. The sr-only text fixes
  both at once: it names the state for assistive tech and stops colour being the
  sole carrier.
*/
function FeatureCheck({ granted }: { granted: boolean }) {
	return (
		<>
			<span className="sr-only">{granted ? 'Included' : 'Not included'}</span>
			{granted ? (
				<Check className="text-primary mx-auto h-4 w-4" />
			) : (
				<Minus className="text-muted-foreground mx-auto h-4 w-4" />
			)}
		</>
	)
}

function FeatureMatrixRow({
	label,
	plans
}: {
	label: string
	plans: { plan: Plan; granted: boolean }[]
}) {
	return (
		<tr className="border-border border-b last:border-0">
			{/*
			  The label column is sticky. The table needs 640px and a phone gives it
			  343, so scrolling right to reach Business and Enterprise used to carry
			  the feature names off screen - leaving a grid of ticks with nothing
			  saying what they were ticks for.
			*/}
			<th
				scope="row"
				className="bg-background text-body-sm sticky left-0 py-3 pr-4 font-normal"
			>
				{label}
			</th>
			{plans.map(({ plan, granted }) => (
				<td key={plan} className="py-3 text-center">
					<FeatureCheck granted={granted} />
				</td>
			))}
		</tr>
	)
}

// ---------------------------------------------------------------------------
// FeatureCompareGrid (exported)
// ---------------------------------------------------------------------------

export function FeatureCompareGrid() {
	return (
		<section>
			{/*
			  tabIndex on the scroll container, because it holds no focusable
			  descendant of its own. Without it the table scrolls by mouse only, and
			  the columns past 640px - Business and Enterprise - are unreachable by
			  keyboard on any narrow screen.
			*/}
			<div
				className="overflow-x-auto"
				tabIndex={0}
				role="region"
				aria-label="Plan comparison"
			>
				<table className="w-full min-w-[640px] table-auto text-left">
					<caption className="sr-only">
						Entitlements by plan. Each row is a feature; each column is a plan.
					</caption>
					<thead>
						<tr className="border-border border-b">
							<th scope="col" className="bg-background sticky left-0 pr-4 pb-4">
								<span className="sr-only">Feature</span>
							</th>
							{PLANS.map((plan) => (
								<th
									scope="col"
									key={plan}
									className={cn(
										'text-body-sm pb-4 text-center font-medium',
										PLAN_HIGHLIGHTED[plan] && 'text-primary'
									)}
								>
									{PLAN_DISPLAY_NAMES[plan]}
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{ENTITLEMENT_FEATURE_GROUPS.map(({ label, features }) => (
							<React.Fragment key={label}>
								<tr className="ds-raised">
									<th
										scope="colgroup"
										colSpan={PLANS.length + 1}
										className="text-eyebrow sticky left-0 py-2 pr-4"
									>
										{label}
									</th>
								</tr>
								{features.map(({ key, label: featureLabel }) => {
									const typedKey =
										key as keyof (typeof PLAN_ENTITLEMENTS)['free']
									return (
										<FeatureMatrixRow
											key={key}
											label={featureLabel}
											plans={PLANS.map((plan) => ({
												plan,
												granted: PLAN_ENTITLEMENTS[plan][typedKey]
											}))}
										/>
									)
								})}
							</React.Fragment>
						))}
					</tbody>
				</table>
			</div>
		</section>
	)
}
