import { userService } from '../../lib/services/user.service'

import { Route } from './+types/dashboard-page'

export async function loader({ request }: Route.LoaderArgs) {
	return null
}

const DashboardPage = () => {
	return <div></div>
}

export default DashboardPage
