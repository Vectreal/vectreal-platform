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

	// Crawl endpoints
	route('robots.txt', './routes/robots[.]txt.ts'),
	route('sitemap.xml', './routes/sitemap[.]xml.ts'),
	route('llms.txt', './routes/llms[.]txt.ts'),

	/// API
	route(
		'api/scenes/:sceneId/thumbnail/:assetId',
		'./routes/api/scenes.$sceneId.thumbnail.$assetId.ts'
	),
	route(
		'api/scenes/:sceneId/assets/:assetId',
		'./routes/api/scenes.$sceneId.assets.$assetId.ts'
	),
	route('api/scenes/:sceneId?', './routes/api/scenes.$sceneId.ts'),
	route('api/scene-location-options', './routes/api/scene-location-options.ts'),
	route('api/dashboard/mutations', './routes/api/dashboard.mutations.ts'),
	route(
		'api/projects/:projectId/api-keys',
		'./routes/api/projects.$projectId.api-keys.ts'
	),

	// Auth api
	route('auth/session', './routes/api/auth/session.ts'),
	route('auth/logout', './routes/api/auth/logout.ts'),
	route('auth/social-signin', './routes/api/auth/social-signin.ts'),
	route('auth/callback', './routes/api/auth/callback.ts'),
	route('auth/confirm', './routes/api/auth/confirm.ts'),
	route('auth/send-email', './routes/api/auth/send-email.ts'),

	// Billing api
	route('api/billing/checkout', './routes/api/billing/checkout.ts'),
	route('api/billing/portal', './routes/api/billing/portal.ts'),
	route('api/billing/webhook', './routes/api/billing/webhook.ts'),
	route('api/billing/reconcile', './routes/api/billing/reconcile.ts'),
	route('api/contact/webhook', './routes/api/contact/webhook.ts'),
	route('api/consent', './routes/api/consent.ts'),
	route('api/theme', './routes/api/theme.ts'),

	/// PAGES
	layout('./routes/layouts/nav-layout.tsx', [
		// sign-in, sign-up, forgot-password, and post-signup confirmation gate
		layout('./routes/layouts/signin-layout.tsx', [
			route('sign-up', './routes/signup-page/signup-page.tsx'),
			route('sign-in', './routes/signin-page/signin-page.tsx'),
			route(
				'forgot-password',
				'./routes/forgot-password-page/forgot-password.tsx'
			),
			route(
				'reset-password',
				'./routes/reset-password-page/reset-password.tsx'
			),
			route('auth/confirm-pending', './routes/confirm-pending.tsx')
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
		route('contact', './routes/contact-page.tsx'),

		// Legal pages
		layout('./routes/layouts/mdx-layout.tsx', { id: 'legal-mdx-layout' }, [
			route('about', './routes/about-page.mdx'),
			route('changelog', './routes/changelog-page.mdx'),
			route('code-of-conduct', './routes/code-of-conduct-page.mdx'),
			route('privacy-policy', './routes/privacy-policy-page.mdx'),
			route('terms-of-service', './routes/terms-of-service-page.mdx'),
			route('imprint', './routes/imprint-page.mdx')
		]),

		// Dev-only newsroom scene contact sheet. Mounted at the top level rather
		// than under news-room/ so it can never collide with news-room/:slug.
		// Its loader 404s outside DEV, and it is absent from prerender paths and
		// the sitemap because both derive from the article manifest.
		//
		// Registered unconditionally on purpose: gating it on NODE_ENV stops
		// `react-router typegen` emitting its +types module, so the route loses
		// type safety. It compiles to its own lazy chunk that production never
		// loads, which is a better trade than an untyped route.
		route('__scenes', './routes/news-room-page/newsroom-scene-preview.tsx'),

		// Publisher. Nested here, rather than in its own top-level branch, so the
		// nav survives navigating into it instead of being torn down and rebuilt.
		// It suppresses the footer (and, once there is a scene to frame, the nav)
		// through routePageChrome.
		layout('./routes/layouts/publisher-layout.tsx', [
			route(
				'publisher/:sceneId?',
				'./routes/publisher-page/publisher.$sceneId.tsx'
			)
		]),

		// News room page
		layout('./routes/layouts/news-room-layout.tsx', [
			route('news-room', './routes/news-room-page/news-room-page.tsx'),
			route(
				'news-room/:slug',
				'./routes/news-room-page/news-room-article-page.tsx'
			)
		]),

		// Docs - platform-first open-source documentation
		...prefix('docs', [
			// Docs landing page - full-width hero, outside the sidebar layout
			index('./routes/docs/index.tsx'),
			layout('./routes/layouts/docs-layout.tsx', [
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
					route('publish-embed', './routes/docs/guides/publish-embed.mdx'),
					route('embed-sdk', './routes/docs/guides/embed-sdk.mdx')
				]),
				// Package Reference
				...prefix('packages', [
					route('embed', './routes/docs/packages/embed.mdx'),
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

	// External embeds: preview API key only, never internal chrome
	layout('./routes/layouts/embed-layout.tsx', [
		route('embed/:projectId/:sceneId', './routes/embed-page/embed-scene.tsx')
	]),

	// Internal preview: session only, reachable from the dashboard
	layout('./routes/layouts/preview-layout.tsx', [
		route(
			'preview/:projectId/:sceneId',
			'./routes/preview-page/preview-scene.tsx'
		)
	]),

	// Embeds published before the /embed split still point here
	route(
		'preview/fullscreen/:projectId/:sceneId/',
		'./routes/embed-page/legacy-embed-redirect.ts'
	),

	// Dashboard - each route handles its own data loading
	...prefix('dashboard', [
		layout('./routes/layouts/dashboard-layout.tsx', [
			index('./routes/dashboard-page/dashboard-page.tsx'),
			...prefix('projects', [
				route('/', './routes/dashboard-page/projects/projects.tsx', [
					route('new', './routes/dashboard-page/projects/projects-new.tsx'),
					/*
					  The same drawer, registered a second time as a child of the list.
					  Opening it from a card used to mount the project detail page
					  behind it and leave you there on close, because the only edit
					  route was nested under `:projectId`. Both entries carry an
					  explicit id so neither takes the implicit path-derived default.
					*/
					route(
						'edit/:projectId',
						'./routes/dashboard-page/projects/projects-edit.tsx',
						{ id: 'projects-list-edit' }
					)
				]),
				route(':projectId', './routes/dashboard-page/projects/project.tsx', [
					route('edit', './routes/dashboard-page/projects/projects-edit.tsx', {
						id: 'project-detail-edit'
					}),
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
