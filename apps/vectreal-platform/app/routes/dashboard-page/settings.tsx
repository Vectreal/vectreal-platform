import { data } from 'react-router'

import { Route } from './+types/settings'
import { loadAuthenticatedUser } from '../../lib/domain/auth/auth-loader.server'

import type { SettingsLoaderData } from '../../lib/domain/dashboard/dashboard-types'


export async function loader({ request }: Route.LoaderArgs) {
	// Authenticate and initialize user
	const { user, userWithDefaults, headers } = await loadAuthenticatedUser(request)

	const loaderData: SettingsLoaderData = {
		user,
		userWithDefaults
	}

	return data(loaderData, { headers })
}

export { DashboardErrorBoundary as ErrorBoundary } from '../../components/errors'

const SettingsPage = () => {
	return null
}

export default SettingsPage
