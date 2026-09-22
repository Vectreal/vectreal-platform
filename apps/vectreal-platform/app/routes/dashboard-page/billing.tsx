import { data, useLoaderData } from 'react-router'

import { Route } from './+types/billing'
import { BillingSettingsSection } from '../../components/dashboard'
import {
	loadBillingDashboardData,
	loadOrgUsage
} from '../../lib/domain/billing/billing-dashboard-loader.server'
import { describeBillingSituation } from '../../lib/domain/billing/billing-situation'
import { describePlanFit } from '../../lib/domain/billing/plan-fit'

/**
 * What is being charged, and whether the plan still fits.
 *
 * The usage counts came off this page in #857, on the grounds that it was
 * paying for five counting queries to render readings it no longer showed.
 * They are back for a different question. That change was right about the
 * readings - "how much have I used" belongs to `/dashboard/usage` and is not
 * repeated here - but this page asks whether the plan is the right one, and
 * that cannot be answered without the reader's own numbers. Only the readings
 * under pressure reach the page, so most visits render none of them.
 */
export async function loader({ request }: Route.LoaderArgs) {
	const { loaderData, organizationId, headers } =
		await loadBillingDashboardData(request, {
			includeCheckoutOptions: false
		})

	const usage = await loadOrgUsage(organizationId)

	/*
	  The effective plan, never the stored one, which is the rule
	  `BillingSettingsSection` states and this loader did not follow. A canceled
	  or incomplete paid organization keeps `pro` in the row and is entitled to
	  `free`, so the section headed itself Free and printed Pro's allowances
	  beneath it, with a button offering the move to Business.
	*/
	const { effectivePlan } = describeBillingSituation(loaderData.billing)

	return data(
		{
			...loaderData,
			planFit: describePlanFit(usage, effectivePlan)
		},
		{ headers }
	)
}

export { DashboardErrorBoundary as ErrorBoundary } from '../../components/errors'

const BillingPage = () => {
	const { billing, planFit } = useLoaderData<typeof loader>()

	return (
		<div className="space-y-8 py-6">
			<BillingSettingsSection billing={billing} planFit={planFit} />
		</div>
	)
}

export default BillingPage
