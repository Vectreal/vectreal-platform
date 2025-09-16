import { useAuth } from '../../contexts/auth-context'

import { Route } from './+types/dashboard'

export async function loader({ request }: Route.LoaderArgs) {
	return null
}

const SettingsPage = () => {
	const { user, error } = useAuth()

	return (
		<div className="p-6">
			<div className="grid gap-6">
				{/* User Info */}
				<section className="rounded-lg p-4 shadow">
					<h2 className="mb-2 text-lg font-semibold">User Information</h2>
					<p>
						<strong>Name:</strong> {user.user_metadata?.name || user.email}
					</p>
					<p>
						<strong>Email:</strong> {user.email}
					</p>
					<p>
						<strong>ID:</strong> {user.id}
					</p>
				</section>
				{/* Error Display */}
				{error && (
					<section className="rounded-lg border border-red-200 bg-red-50 p-4">
						<h2 className="mb-2 text-lg font-semibold text-red-800">
							Initialization Error
						</h2>
						<p className="text-red-700">{error}</p>
					</section>
				)}
			</div>
		</div>
	)
}

export default SettingsPage
