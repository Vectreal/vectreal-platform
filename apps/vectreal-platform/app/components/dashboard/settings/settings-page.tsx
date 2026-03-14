import { useLoaderData, useSearchParams } from 'react-router'

import { BillingSettingsSection } from './billing-settings-section'

import type { loader } from '../../../routes/dashboard-page/settings'

export default function SettingsPage() {
	const { billing } = useLoaderData<typeof loader>()
	const [searchParams] = useSearchParams()
	const upgradeTarget = searchParams.get('upgrade')

	return (
		<div className="space-y-10 p-6">
			<div>
				<h1 className="text-2xl font-bold">Settings</h1>
				<p className="text-muted-foreground mt-1 text-sm">
					Manage your account, billing, and organisation preferences.
				</p>
			</div>

			<section className="space-y-4">
				<h2 className="text-lg font-semibold">Billing &amp; Plan</h2>
				<BillingSettingsSection
					billing={billing}
					defaultUpgradeTarget={
						upgradeTarget as 'pro' | 'business' | null ?? null
					}
				/>
			</section>
		</div>
	)
}
