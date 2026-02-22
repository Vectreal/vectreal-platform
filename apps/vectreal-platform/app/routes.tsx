import {
	index,
	layout,
	prefix,
	route,
	type RouteConfig
} from '@react-router/dev/routes'

export default [
	// Health check endpoint for Docker and monitoring
	route('health', './routes/health.tsx'),

	/// API
	route('api/scenes/:sceneId?', './routes/api/scenes.$sceneId.ts'),
	route('api/optimize-textures', './routes/api/optimize-textures.ts'),
	// AUTH API
	route('auth/logout', './routes/api/auth/logout.ts'),
	route('auth/social-signin', './routes/api/auth/social-signin.ts'),
	route('auth/callback', './routes/api/auth/callback.ts'),
	route('auth/confirm', './routes/api/auth/confirm.ts'),

	/// PAGES
	// sign-in and sign-up
	layout('./routes/layouts/nav-layout.tsx', [
		layout('./routes/layouts/signin-layout.tsx', [
			route('sign-up', './routes/signup-page/signup-page.tsx'),
			route('sign-in', './routes/signin-page/signin-page.tsx')
		]),

		// home page - index route
		// This is the default route that will be loaded when the app starts
		index('./routes/home-page/home-page.tsx', {
			id: 'home-index'
		}),
		// For users which are authenticated, the home page is available at "/home"
		route('home', './routes/home-page/home-page.tsx', {
			id: 'home-page'
		}),
		layout('./routes/layouts/mdx-layout.tsx', [
			route('about', './routes/about-page.mdx'),
			route('contact', './routes/contact-page.mdx'),
			route('privacy-policy', './routes/privacy-policy-page.mdx'),
			route('terms-of-service', './routes/terms-of-service-page.mdx'),
			route('imprint', './routes/imprint-page.mdx')
		])
	]),

	// publisher
	layout('./routes/layouts/publisher-layout.tsx', [
		route('publisher/:sceneId?', './routes/publisher-page/publisher-page.tsx')
	]),

	// dashboard - each route handles its own data loading
	...prefix('dashboard', [
		layout('./routes/layouts/dashboard-layout.tsx', [
			index('./routes/dashboard-page/dashboard.tsx'),
			...prefix('projects', [
				route('/', './routes/dashboard-page/projects/projects.tsx', [
					route('new', './routes/dashboard-page/projects/projects-new.tsx')
				]),
				route(':projectId', './routes/dashboard-page/projects/project.tsx', [
					route(
						'folder/:folderId',
						'./routes/dashboard-page/projects/folder.tsx'
					),
					route(':sceneId', './routes/dashboard-page/projects/scene.tsx')
				])
			]),
			route('organizations', './routes/dashboard-page/organizations.tsx'),
			route('settings', './routes/dashboard-page/settings.tsx')
		])
	])
] satisfies RouteConfig
