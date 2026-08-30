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

import { stripSingleFetchSuffix } from '../http/single-fetch-path'

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
	/*
	  Step zero. Everything below it assumes an account, and for a while creating
	  one was reliably broken while this list said the funnel started at "save a
	  scene" - the route reported nothing at all on the branch that was firing.
	*/
	{
		id: 'create-account',
		step: 'create an account',
		module: 'app/lib/domain/auth/signup-failure.ts',
		routes: [
			{
				file: './routes/signup-page/signup-page.tsx',
				pattern: /^\/sign-up$/
			}
		]
	},
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
	},
	{
		/*
		  The funnel used to stop at "serve the manifest", and that gap is exactly
		  how a finished hotspot renderer shipped with nothing calling it: the
		  server had been handing the settings over correctly for months while the
		  component that turns them into pixels was never given them. Serving a
		  payload nobody draws is not a served scene, so the last hop belongs on
		  the list too.
		*/
		id: 'render-embed-scene',
		step: 'draw the published scene the manifest described',
		module: 'app/components/scene-embed/scene-embed-viewer.tsx',
		routes: [
			{
				file: './routes/embed-page/embed-scene.tsx',
				pattern: /^\/embed\/[^/]+\/[^/]+$/
			},
			{
				file: './routes/preview-page/preview-scene.tsx',
				pattern: /^\/preview\/[^/]+\/[^/]+$/
			},
			/*
			  The dashboard's scene detail panel renders this component as well, so
			  it belongs here by the rule this list is built on: routes come from the
			  module's actual importers, not from what the step sounds like it should
			  serve. Same lookaheads as `copy-snippet` above, and for the same reason
			  - the edit drawer shares this URL shape.
			*/
			{
				file: './routes/dashboard-page/projects/scene.tsx',
				pattern: /^\/dashboard\/projects\/(?!edit\/)[^/]+\/(?!edit$)[^/]+$/
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
function normalizeRoutePath(pathname: string): string {
	const withoutSuffix = stripSingleFetchSuffix(pathname).toLowerCase()
	// `/` has no trailing slash to strip - it is the slash.
	return withoutSuffix.length > 1
		? withoutSuffix.replace(/\/+$/, '')
		: withoutSuffix
}

export function criticalFlowsForPathname(pathname: string): string[] {
	/*
	  Normalized to the route React Router would match, in three steps, because
	  the patterns below are anchored and case-sensitive while the router is
	  neither.

	  The suffix first: with JavaScript running the sign-up form does not post to
	  `/sign-up`, single fetch posts to `/sign-up.data`, and `reportServerError`
	  reads the pathname straight off the request. Then case and a trailing
	  slash, because the router compiles every path with a trailing `\/*$` and
	  matches case-insensitively - so `/sign-up/` and `/SIGN-UP` both serve the
	  sign-up page, and `/sign-up/` is also what the `_.data` spelling decodes
	  to. Matching the raw path tagged every real sign-up failure with no flow at
	  all, which is precisely the alert `create-account` was added to raise.
	*/
	const routePath = normalizeRoutePath(pathname)
	return CRITICAL_FLOWS.filter((flow) =>
		flow.routes.some((route) => route.pattern.test(routePath))
	).map((flow) => flow.id)
}
