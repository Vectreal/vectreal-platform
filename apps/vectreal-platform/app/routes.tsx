import {
	index,
	layout,
	route,
	type RouteConfig
} from '@react-router/dev/routes'

export default [
	// api
	route('api/update-theme', './routes/api/update-theme.ts'),
	// public routes

	layout('./components/navigation/nav-layout.tsx', [
		index('./routes/home-page/home-page.tsx'),
		layout('./routes/publisher-page/publisher-layout.tsx', [
			route('publisher', './routes/publisher-page/publisher-page.tsx')
		])
	])
] satisfies RouteConfig
