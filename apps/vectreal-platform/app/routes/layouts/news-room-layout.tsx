import { Outlet } from 'react-router'

const NewsRoomLayout = () => {
	return (
		<div className="bg-background min-h-screen">
			<Outlet />
		</div>
	)
}

export default NewsRoomLayout
