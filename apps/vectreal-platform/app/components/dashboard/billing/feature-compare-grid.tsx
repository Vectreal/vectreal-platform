/**
 * FeatureCompareGrid
 * Full feature comparison table across all four plans.
 * Extracted from pricing-page.tsx so it can be reused on the upgrade route.
 */

import { cn } from '@shared/utils'
import { Check, Minus } from 'lucide-react'
import React from 'react'

import { PLAN_ENTITLEMENTS, type Plan } from '../../../constants/plan-config'
import {
	ENTITLEMENT_FEATURE_GROUPS,
	PLAN_DISPLAY_NAMES,
	PLAN_HIGHLIGHTED
} from '../../../constants/product-copy'

const PLANS: Plan[] = ['free', 'pro', 'business', 'enterprise']

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function FeatureCheck({ granted }: { granted: boolean }) {
	if (granted) {
		return <Check className="text-primary mx-auto h-4 w-4" />
	}
	return <Minus className="text-muted-foreground mx-auto h-4 w-4" />
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
			<td className="py-3 pr-4 text-sm">{label}</td>
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
		<section className="space-y-4">
			<h2 className="text-2xl font-medium">Full feature comparison</h2>
			<div className="overflow-x-auto">
				<table className="w-full min-w-[640px] table-auto text-left">
					<thead>
						<tr className="border-border border-b">
							<th className="pr-4 pb-4 text-sm font-medium" />
							{PLANS.map((plan) => (
								<th
									key={plan}
									className={cn(
										'pb-4 text-center text-sm font-semibold',
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
								<tr className="bg-muted/30">
									<td
										colSpan={PLANS.length + 1}
										className="py-2 pr-4 text-xs font-semibold tracking-wider uppercase"
									>
										{label}
									</td>
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
