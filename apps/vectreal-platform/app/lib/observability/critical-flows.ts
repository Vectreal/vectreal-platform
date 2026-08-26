/**
 * The funnel this product exists to serve, as data.
 *
 * One list, two readers. `tests/critical-path.spec.ts` asserts that every
 * step's owning module is exercised by a spec; `error-report.ts` tags a
 * reported error with the steps whose routes it arrived on. They read the same
 * array on purpose: the set of flows that is test-guarded and the set that is
 * observable have to stay identical, and a second copy of the list is the one
 * thing that guarantees they will not.
 *
 * Pure and free of any database or PostHog import, so both readers - and the
 * spec that checks the patterns below - can import it directly.
 */

export type CriticalFlowRoute = {
	/**
	 * The route module, exactly as `app/routes.tsx` registers it.
	 *
	 * Carried so the spec can assert the route is still mounted. A pattern for a
	 * route that has been renamed or unmounted matches nothing and would tag
	 * nothing, silently, forever.
	 */
	file: string
	/** Pathnames that route serves. */
	pattern: RegExp
}

export type CriticalFlow = {
	/**
	 * Stable id, sent to PostHog as part of `critical_flows`.
	 *
	 * Renaming one renames it in every saved insight and alert, so treat these
	 * as an external contract rather than as a label.
	 */
	id: string
	/** What the user is doing. */
	step: string
	/** The module that owns the decision for this step, relative to the app. */
	module: string
	/**
	 * The registered routes that reach that module.
	 *
	 * Derived from the modules' actual importers, not from what the step sounds
	 * like it should serve. Several steps share a route because several steps
	 * genuinely run there - `/api/scenes/:sceneId` both saves a scene and serves
	 * the manifest - which is why attribution below returns a list.
	 */
	routes: CriticalFlowRoute[]
}

const API_SCENE = {
	file: './routes/api/scenes.$sceneId.ts',
	pattern: /^\/api\/scenes(\/[^/]+)?$/
}

const API_PROJECT_KEYS = {
	file: './routes/api/projects.$projectId.api-keys.ts',
	pattern: /^\/api\/projects\/[^/]+\/api-keys$/
}

export const CRITICAL_FLOWS: CriticalFlow[] = [
	{
		id: 'save-scene',
		step: 'save a scene',
		module: 'app/lib/domain/scene/server/scene-settings.operations.server.ts',
		routes: [API_SCENE]
	},
	{
		id: 'publish-scene',
		step: 'publish it, and decide what an embed may fetch',
		module: 'app/lib/domain/scene/embed-asset-policy.ts',
		routes: [
			API_SCENE,
			{
				file: './routes/api/scenes.$sceneId.assets.$assetId.ts',
				pattern: /^\/api\/scenes\/[^/]+\/assets\/[^/]+$/
			},
			{
				file: './routes/api/scenes.$sceneId.thumbnail.$assetId.ts',
				pattern: /^\/api\/scenes\/[^/]+\/thumbnail\/[^/]+$/
			}
		]
	},
	{
		id: 'mint-api-key',
		step: 'mint an API key scoped to the project',
		module: 'app/lib/domain/auth/api-key-repository.server.ts',
		routes: [
			API_PROJECT_KEYS,
			{
				file: './routes/dashboard-page/api-keys.tsx',
				pattern: /^\/dashboard\/api-keys(\/.*)?$/
			}
		]
	},
	{
		id: 'allow-domain',
		step: 'allow the storefront domain',
		module: 'app/lib/domain/embed/embed-domain-policy.ts',
		routes: [
			API_PROJECT_KEYS,
			/*
			  The edit drawer is mounted twice, under the project list and under the
			  project detail page, so it answers on two unrelated paths. Both are
			  listed because both reach the module.
			*/
			{
				file: './routes/dashboard-page/projects/projects-edit.tsx',
				pattern: /^\/dashboard\/projects\/edit\/[^/]+$/
			},
			{
				file: './routes/dashboard-page/projects/projects-edit.tsx',
				pattern: /^\/dashboard\/projects\/[^/]+\/edit$/
			}
		]
	},
	{
		id: 'copy-snippet',
		step: 'copy a snippet that carries the key',
		module: 'app/lib/domain/embed/embed-snippet.ts',
		routes: [
			/*
			  `/dashboard/projects/:projectId/:sceneId` and
			  `/dashboard/projects/edit/:projectId` are the same shape, so the scene
			  page's pattern has to exclude the drawer explicitly. Without the
			  lookaheads an error in the edit drawer would be filed under "copy a
			  snippet", which is worse than filing it under nothing.
			*/
			{
				file: './routes/dashboard-page/projects/scene.tsx',
				pattern: /^\/dashboard\/projects\/(?!edit\/)[^/]+\/(?!edit$)[^/]+$/
			},
			/*
			  Named by the layout, not the leaf page, because the layout is what
			  imports the module - and the layout runs for every path beneath it.
			*/
			{
				file: './routes/layouts/preview-layout.tsx',
				pattern: /^\/preview\/[^/]+\/[^/]+$/
			},
			{
				file: './routes/embed-page/legacy-embed-redirect.ts',
				pattern: /^\/preview\/fullscreen\/[^/]+\/[^/]+\/?$/
			}
		]
	},
	{
		id: 'authorize-embed',
		step: 'authorize the third-party request',
		module: 'app/lib/domain/embed/embed-access-policy.ts',
		routes: [
			{
				file: './routes/layouts/embed-layout.tsx',
				pattern: /^\/embed\/[^/]+\/[^/]+$/
			},
			API_SCENE,
			{
				file: './routes/api/scenes.$sceneId.assets.$assetId.ts',
				pattern: /^\/api\/scenes\/[^/]+\/assets\/[^/]+$/
			}
		]
	},
	{
		id: 'serve-manifest',
		step: 'serve the embed manifest',
		module: 'app/lib/domain/scene/server/scene-manifest.server.ts',
		routes: [
			API_SCENE,
			{
				file: './routes/layouts/publisher-layout.tsx',
				pattern: /^\/publisher(\/[^/]+)?$/
			}
		]
	}
]

/**
 * The ids of every critical flow served by a pathname, in funnel order.
 *
 * A list rather than a single id because one route serves several steps.
 * Callers that only need "was this on the funnel at all" should read the
 * length; the ids are for narrowing once an alert has fired.
 */
export function criticalFlowsForPathname(pathname: string): string[] {
	return CRITICAL_FLOWS.filter((flow) =>
		flow.routes.some((route) => route.pattern.test(pathname))
	).map((flow) => flow.id)
}
