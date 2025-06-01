import {
	index,
	layout,
	route,
	type RouteConfig
} from '@react-router/dev/routes'

export default [
	// API
	route('api/update-theme', './routes/api/update-theme.ts'),

	// auth
	route('auth/logout', './routes/api/auth/logout.ts'),
	route('auth/social-signin', './routes/api/auth/social-signin.ts'),
	route('auth/callback', './routes/api/auth/callback.ts'),
	route('auth/confirm', './routes/api/auth/confirm.ts'),

	layout('./routes/layouts/nav-layout.tsx', [
		// PUBLIC ROUTES
		// home page
		index('./routes/home-page/home-page.tsx'),
		// sign-in and sign-up
		layout('./routes/layouts/signin-layout.tsx', [
			route('sign-up', './routes/signup-page/signup-page.tsx'),
			route('sign-in', './routes/signin-page/signin-page.tsx')
		]),
		// publisher
		layout('./routes/layouts/publisher-layout.tsx', [
			route('publisher', './routes/publisher-page/publisher-page.tsx')
		]),

		// PROTECTED ROUTES
		// dashboard
		layout('./routes/layouts/auth-layout.tsx', [
			route('dashboard', './routes/dashboard-page/dashboard-page.tsx')
		])
	])
] satisfies RouteConfig
