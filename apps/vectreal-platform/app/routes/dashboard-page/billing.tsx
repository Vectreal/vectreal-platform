import { data, useLoaderData } from 'react-router'

import { Route } from './+types/billing'
import { BillingSettingsSection } from '../../components/dashboard'
import { loadBillingDashboardData } from '../../lib/domain/billing/billing-dashboard-loader.server'

export async function loader({ request }: Route.LoaderArgs) {
	const { loaderData, headers } = await loadBillingDashboardData(request, {
		includeCheckoutOptions: false
	})
	return data(loaderData, { headers })
}

export { DashboardErrorBoundary as ErrorBoundary } from '../../components/errors'

const BillingUpgradePage = () => {
	const { billing } = useLoaderData<typeof loader>()

	return (
		<div className="p-6">
			<BillingSettingsSection billing={billing} />
		</div>
	)
}

export default BillingUpgradePage
