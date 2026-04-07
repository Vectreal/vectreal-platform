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
	route(
		'api/scenes/:sceneId/thumbnail/:assetId',
		'./routes/api/scenes.$sceneId.thumbnail.$assetId.ts'
	),
	route('api/scenes/:sceneId?', './routes/api/scenes.$sceneId.ts'),
	route('api/scene-location-options', './routes/api/scene-location-options.ts'),
	route('api/optimize-textures', './routes/api/optimize-textures.ts'),

	// Auth api
	route('auth/logout', './routes/api/auth/logout.ts'),
	route('auth/social-signin', './routes/api/auth/social-signin.ts'),
	route('auth/callback', './routes/api/auth/callback.ts'),
	route('auth/confirm', './routes/api/auth/confirm.ts'),

	// Billing api
	route('api/billing/checkout', './routes/api/billing/checkout.ts'),
	route(
		'api/billing/optimization-runs',
		'./routes/api/billing/optimization-runs.ts'
	),
	route('api/billing/portal', './routes/api/billing/portal.ts'),
	route('api/billing/webhook', './routes/api/billing/webhook.ts'),
	route('api/billing/reconcile', './routes/api/billing/reconcile.ts'),
	route('api/consent', './routes/api/consent.ts'),

	/// PAGES
	layout('./routes/layouts/nav-layout.tsx', [
		// sign-in and sign-up
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

		// Pricing page
		route('pricing', './routes/pricing-page/pricing-page.tsx'),

		// Legal pages
		layout('./routes/layouts/mdx-layout.tsx', { id: 'legal-mdx-layout' }, [
			route('about', './routes/about-page.mdx'),
			route('changelog', './routes/changelog-page.mdx'),
			route('contact', './routes/contact-page.mdx'),
			route('code-of-conduct', './routes/code-of-conduct-page.mdx'),
			route('privacy-policy', './routes/privacy-policy-page.mdx'),
			route('terms-of-service', './routes/terms-of-service-page.mdx'),
			route('imprint', './routes/imprint-page.mdx')
		]),

		// News room page
		layout('./routes/layouts/news-room-layout.tsx', [
			route('news-room', './routes/news-room-page/news-room-page.tsx'),
			route(
				'news-room/:slug',
				'./routes/news-room-page/news-room-article-page.tsx'
			)
		]),

		// Docs — platform-first open-source documentation
		...prefix('docs', [
			layout('./routes/layouts/docs-layout.tsx', [
				index('./routes/docs/index.mdx'),
				// Getting Started
				...prefix('getting-started', [
					index('./routes/docs/getting-started/index.mdx', {
						id: 'docs-getting-started-index'
					}),
					route(
						'installation',
						'./routes/docs/getting-started/installation.mdx'
					),
					route('first-model', './routes/docs/getting-started/first-model.mdx')
				]),
				// Guides
				...prefix('guides', [
					route('upload', './routes/docs/guides/upload.mdx'),
					route('optimize', './routes/docs/guides/optimize.mdx'),
					route('publish-embed', './routes/docs/guides/publish-embed.mdx')
				]),
				// Package Reference
				...prefix('packages', [
					route('viewer', './routes/docs/packages/viewer.mdx'),
					route('hooks', './routes/docs/packages/hooks.mdx'),
					route('core', './routes/docs/packages/core.mdx')
				]),
				// Operations
				...prefix('operations', [
					route('deployment', './routes/docs/operations/deployment.mdx')
				]),
				// Contributing
				route('contributing', './routes/docs/contributing.mdx'),
				// Docs fallback for unknown nested pages
				route('*', './routes/docs/docs-not-found.tsx')
			])
		])
	]),

	// First-run onboarding (standalone page, no nav layout)
	route('onboarding', './routes/onboarding-page/onboarding-page.tsx'),

	// Publisher
	layout('./routes/layouts/publisher-layout.tsx', [
		route(
			'publisher/:sceneId?',
			'./routes/publisher-page/publisher.$sceneId.tsx'
		)
	]),

	// Preview page for scenes
	layout('./routes/layouts/preview-layout.tsx', [
		route(
			'preview/fullscreen/:projectId/:sceneId/',
			'./routes/preview-page/preview-fullscreen.tsx'
		),
		route(
			'preview/product-detail/:projectId/:sceneId/',
			'./routes/preview-page/preview-product-detail.tsx'
		)
	]),

	// Dashboard - each route handles its own data loading
	...prefix('dashboard', [
		layout('./routes/layouts/dashboard-layout.tsx', [
			index('./routes/dashboard-page/dashboard-page.tsx'),
			...prefix('projects', [
				route('/', './routes/dashboard-page/projects/projects.tsx', [
					route('new', './routes/dashboard-page/projects/projects-new.tsx')
				]),
				route(':projectId', './routes/dashboard-page/projects/project.tsx', [
					route('edit', './routes/dashboard-page/projects/projects-edit.tsx'),
					route(
						'folder/:folderId',
						'./routes/dashboard-page/projects/folder.tsx'
					),
					route(':sceneId', './routes/dashboard-page/projects/scene.tsx')
				])
			]),
			route('api-keys', './routes/dashboard-page/api-keys.tsx', [
				route('new', './routes/dashboard-page/api-keys-new.tsx'),
				route(':keyId/edit', './routes/dashboard-page/api-keys-edit.tsx')
			]),
			route('organizations', './routes/dashboard-page/organizations.tsx', [
				route(
					':organizationId',
					'./routes/dashboard-page/organizations.$organizationId.tsx'
				)
			]),
			route('billing', './routes/dashboard-page/billing.tsx'),
			route('billing/upgrade', './routes/dashboard-page/billing-upgrade.tsx'),
			route(
				'billing/upgrade-success',
				'./routes/dashboard-page/billing-upgrade-success.tsx'
			),
			route(
				'billing/upgrade-canceled',
				'./routes/dashboard-page/billing-upgrade-canceled.tsx'
			),
			route('settings', './routes/dashboard-page/settings.tsx')
		])
	])
] satisfies RouteConfig
