import { Outlet } from 'react-router'

const NewsRoomLayout = () => {
	return (
		<div className="bg-background min-h-dvh">
			<Outlet />
		</div>
	)
}

export default NewsRoomLayout
