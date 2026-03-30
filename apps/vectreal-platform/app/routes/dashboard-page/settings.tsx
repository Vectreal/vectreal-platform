import { data } from 'react-router'

import { Route } from './+types/settings'
import { loadAuthenticatedUser } from '../../lib/domain/auth/auth-loader.server'

import type { SettingsLoaderData } from '../../lib/domain/dashboard/dashboard-types'

export async function loader({ request }: Route.LoaderArgs) {
	// Authenticate and initialize user
	const { user, userWithDefaults, headers } =
		await loadAuthenticatedUser(request)

	const loaderData: SettingsLoaderData = {
		user,
		userWithDefaults
	}

	return data(loaderData, { headers })
}

export { DashboardErrorBoundary as ErrorBoundary } from '../../components/errors'

export default function SettingsPage() {
	return (
		<div className="space-y-4 p-6">
			<section className="rounded-lg border p-6">
				<h2 className="text-lg font-semibold">General settings</h2>
				<p className="text-muted-foreground mt-2 text-sm">
					Account and organisation preferences will be managed here.
				</p>
			</section>
		</div>
	)
}
