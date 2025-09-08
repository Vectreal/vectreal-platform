import { useUserOrganizations } from '../../contexts/auth-context'

import { Route } from './+types/dashboard'

export async function loader({ request }: Route.LoaderArgs) {
	return null
}

const DashboardPage = () => {
	const organizations = useUserOrganizations()
	return <div className="p-6">{}</div>
}

export default DashboardPage
