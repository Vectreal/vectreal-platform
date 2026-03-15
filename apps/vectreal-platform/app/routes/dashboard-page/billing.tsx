import { data } from 'react-router'

import { Route } from './+types/billing'
import { loadBillingDashboardData } from '../../lib/domain/billing/billing-dashboard-loader.server'

export async function loader({ request }: Route.LoaderArgs) {
	const { loaderData, headers } = await loadBillingDashboardData(request)
	return data(loaderData, { headers })
}

export { DashboardErrorBoundary as ErrorBoundary } from '../../components/errors'

export { default } from '../../components/dashboard/billing/billing-page'
