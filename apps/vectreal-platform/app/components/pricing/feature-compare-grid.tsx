/**
 * FeatureCompareGrid
 * Full feature comparison table across all four plans.
 * Extracted from pricing-page.tsx so it can be reused on the upgrade route.
 */

import { cn } from '@shared/utils'
import { Check, Minus } from 'lucide-react'
import React from 'react'

import {
	ALL_PLANS,
	PLAN_ENTITLEMENTS,
	type Plan
} from '../../constants/plan-config'
import {
	ENTITLEMENT_FEATURE_GROUPS,
	PLAN_DISPLAY_NAMES,
	PLAN_HIGHLIGHTED
} from '../../constants/product-copy'

const PLANS = ALL_PLANS

/*
  The feature column's width while the table is narrower than its content: 9rem
  of wrapped label beside four plan columns of 4.5rem each, which is the
  table's phone minimum below, so two and a half plans show at rest and the
  rest are a short scroll away. Equal, so no plan reads as more important
  because its name is longer.
*/
const FEATURE_COLUMN = 'w-36 md:w-auto'
const PLAN_COLUMN = 'w-18 md:w-1/8'

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
				<Check className="text-foreground mx-auto h-4 w-4" />
			) : (
				<Minus className="text-muted-foreground mx-auto h-4 w-4" />
			)}
		</>
	)
}

/*
  Rows alternate on a sunken fill rather than being ruled off: the eye follows
  a band across four columns, and the fill sits a step under the group bands so
  the two never read as the same thing. The sticky label cell carries the row's
  own fill, or the stripe would break under it while the table scrolls.
*/
function FeatureMatrixRow({
	label,
	plans,
	striped
}: {
	label: string
	plans: { plan: Plan; granted: boolean }[]
	striped: boolean
}) {
	const fill = striped ? 'ds-sunken' : 'bg-background'
	return (
		<tr className={cn(striped && 'ds-sunken')}>
			{/*
			  The label column is sticky. A phone shows 343px of the table, so
			  scrolling right to reach Business and Enterprise used to carry the
			  feature names off screen - leaving a grid of ticks with nothing saying
			  what they were ticks for.

			  And it has a width on a phone, `FEATURE_COLUMN`. Without one it took
			  whatever the other columns left of the table's minimum: 361px, wider
			  than the screen, so every plan value started off it and slid under
			  this column when scrolled, and a phone showed no value at all.
			*/}
			<th
				scope="row"
				className={cn(
					'text-body-sm sticky left-0 py-3 pr-4 pl-3 font-normal',
					fill,
					FEATURE_COLUMN
				)}
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

			  `relative`, so it is the containing block of the cells' sr-only labels.
			  They are absolutely positioned, and an overflow container clips only
			  what resolves against it or something inside it: with nothing
			  positioned here they resolved against the page, and the ones in the
			  columns past the screen widened a 375px phone's page to 602px.
			*/}
			<div
				className="relative overflow-x-auto"
				tabIndex={0}
				role="region"
				aria-label="Plan comparison"
			>
				<table className="w-full min-w-[27rem] table-auto text-left md:min-w-[40rem]">
					<caption className="sr-only">
						Entitlements by plan. Each row is a feature; each column is a plan.
					</caption>
					<thead>
						<tr>
							<th
								scope="col"
								className={cn(
									'bg-background sticky left-0 pr-4 pb-4 pl-3',
									FEATURE_COLUMN
								)}
							>
								<span className="sr-only">Feature</span>
							</th>
							{PLANS.map((plan) => (
								<th
									scope="col"
									key={plan}
									className={cn(
										'text-body-sm pb-4 text-center font-medium',
										PLAN_COLUMN,
										PLAN_HIGHLIGHTED[plan] && 'text-foreground'
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
									{/*
									  No scope. This header labels the rows beneath it, and
									  `colgroup` scopes to a column group - it told assistive
									  tech that "Publishing" describes the plan columns. All the
									  groups share one tbody, so `rowgroup` would be wrong too
									  without splitting it.

									  In the feature column only, with the rest of the row
									  filled. Spanning the whole table, it was as wide as what
									  it scrolls in, so it could not stay put, and on a
									  phone the label scrolled away and left an empty bar.
									*/}
									<th className="text-eyebrow sticky left-0 py-2 pr-4 pl-3">
										{label}
									</th>
									<td colSpan={PLANS.length} />
								</tr>
								{features.map(({ key, label: featureLabel }, index) => {
									const typedKey =
										key as keyof (typeof PLAN_ENTITLEMENTS)['free']
									return (
										<FeatureMatrixRow
											key={key}
											label={featureLabel}
											striped={index % 2 === 1}
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
