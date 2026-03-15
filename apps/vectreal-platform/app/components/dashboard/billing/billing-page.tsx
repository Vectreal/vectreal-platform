import { useLoaderData } from 'react-router'

import { BillingSettingsSection } from '../settings/billing-settings-section'

import type { loader } from '../../../routes/dashboard-page/billing'

export default function BillingPage() {
	const { billing } = useLoaderData<typeof loader>()

	return (
		<div className="space-y-6 p-6">
			<BillingSettingsSection billing={billing} />
		</div>
	)
}
