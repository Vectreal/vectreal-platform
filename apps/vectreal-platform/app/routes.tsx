import {
	index,
	layout,
	route,
	type RouteConfig
} from '@react-router/dev/routes'

export default [
	// API
	route('api/update-theme', './routes/api/update-theme.ts'),
	route('api/convert-anonymous-user', './routes/api/convert-anonymous-user.ts'),
	route('api/scene-settings', './routes/api/scene-settings.ts'),
	route('api/upload-thumbnail', './routes/api/upload-thumbnail.ts'),

	// auth
	route('auth/logout', './routes/api/auth/logout.ts'),
	route('auth/social-signin', './routes/api/auth/social-signin.ts'),
	route('auth/callback', './routes/api/auth/callback.ts'),
	route('auth/confirm', './routes/api/auth/confirm.ts'),

	// PUBLIC ROUTES
	// home page
	// index route
	// This is the default route that will be loaded when the app starts
	layout('./routes/layouts/nav-layout.tsx', [
		index('./routes/home-page/home-page.tsx', {
			id: 'home-index'
		}),
		// For users which are authenticated, the home page is available at "/home"
		route('home', './routes/home-page/home-page.tsx', {
			id: 'home-page'
		}),
		// sign-in and sign-up
		layout('./routes/layouts/signin-layout.tsx', [
			route('sign-up', './routes/signup-page/signup-page.tsx'),
			route('sign-in', './routes/signin-page/signin-page.tsx')
		])
	]),
	// publisher
	layout('./routes/layouts/publisher-layout.tsx', [
		route(
			'publisher/:step?/:panel?',
			'./routes/publisher-page/publisher-page.tsx'
		)
	]),

	// PROTECTED ROUTES
	// dashboard
	layout('./routes/layouts/auth-layout.tsx', [
		layout('./routes/layouts/dashboard-layout.tsx', [
			route('dashboard', './routes/dashboard-page/dashboard-page.tsx')
		])
	])
] satisfies RouteConfig
