import { usePostHog } from '@posthog/react'
import { Toaster } from '@shared/components/ui/sonner'
import { cn } from '@shared/utils'
import { useEffect, type ReactNode } from 'react'
import {
	data,
	Links,
	Meta,
	type MetaFunction,
	Outlet,
	Scripts,
	ScrollRestoration,
	useLoaderData,
	useLocation,
	useRouteError
} from 'react-router'
import { AuthenticityTokenProvider } from 'remix-utils/csrf/react'

import { Route } from './+types/root'
import { ConsentBanner } from './components/consent/consent-banner'
import { ConsentProvider } from './components/consent/consent-context'
import { ConsentPreferencesDialog } from './components/consent/consent-preferences-dialog'
import { GlobalNavigationLoader } from './components/global-navigation-loader'
import {
	isForceDarkRoute,
	ThemeController,
	ThemeScript
} from './components/theme'
import { shouldRenderConsentUi } from './lib/consent/consent-surfaces'
import { isAnonymousCacheableRequest } from './lib/http/cacheable-public-paths.server'
import { useErrorReport } from './lib/observability/use-error-report'
import { posthogMiddleware } from './lib/posthog/posthog-middleware'
import { buildMeta } from './lib/seo'
import {
	buildOrganizationJsonLd,
	buildWebApplicationJsonLd,
	buildWebSiteJsonLd
} from './lib/seo-registry'
import { commitValidCsrfToken } from './lib/sessions/csrf-session.server'

import type { ShouldRevalidateFunction } from 'react-router'
import '@shared/components/styles/globals.css'
import './styles/view-transitions.css'

export const meta: MetaFunction = () => [
	...buildMeta([], undefined, {
		canonical: '/',
		structuredData: [
			buildOrganizationJsonLd(),
			buildWebSiteJsonLd(),
			buildWebApplicationJsonLd()
		]
	})
]

export const middleware: Route.MiddlewareFunction[] = [posthogMiddleware]

export async function loader({ request }: Route.LoaderArgs) {
	const pathname = new URL(request.url).pathname

	// Keep liveness checks isolated from session and database dependencies.
	if (pathname === '/health') {
		return {
			csrf: '',
			forceDarkTheme: false
		}
	}

	// forceDarkTheme is route-derived (not per-visitor), so it stays cache-safe.
	// The visitor's own theme preference is read from the cookie client-side by
	// ThemeScript, never baked into this (CDN-cached) HTML.
	const forceDarkTheme = isForceDarkRoute(pathname)

	// Anonymous-cacheable responses must carry NO per-visitor state. The CSRF
	// cookie/token is per-visitor, and remix-utils omits its Set-Cookie for
	// returning visitors, which would let the edge cache and fan out one
	// visitor's token. Mint the token only on non-cacheable (no-store)
	// responses; the root loader revalidates into those before any POST.
	if (isAnonymousCacheableRequest(request)) {
		return {
			csrf: '',
			forceDarkTheme
		}
	}

	const [csrf, cookieHeader] = await commitValidCsrfToken(request)

	const loaderData = {
		csrf,
		forceDarkTheme
	}

	const responseHeaders = new Headers()
	if (cookieHeader) responseHeaders.append('Set-Cookie', cookieHeader)

	return data(loaderData, { headers: responseHeaders })
}

export const shouldRevalidate: ShouldRevalidateFunction = ({
	currentUrl,
	nextUrl,
	formMethod,
	actionResult,
	defaultShouldRevalidate
}) => {
	if (formMethod && formMethod !== 'GET') {
		return true
	}

	if (actionResult) {
		return true
	}

	if (currentUrl.pathname === nextUrl.pathname) {
		return false
	}

	return defaultShouldRevalidate
}

export type RootLoader = typeof loader

function PageViewTracker() {
	const location = useLocation()
	const posthog = usePostHog()

	useEffect(() => {
		posthog?.capture('$pageview', { $current_url: window.location.href })
	}, [location.pathname, location.search, posthog])

	return null
}

const CriticalStyles = () => (
	<style>
		{`/* Critical CSS for initial render */
			body {
				font-family: 'DM Sans Variable', sans-serif;
			}
			
			button, a {
				cursor: pointer;
			}
	`}
	</style>
)

export function Layout({ children }: { children: ReactNode }) {
	const error = useRouteError()
	/*
	  Reporting lives here, not only in `ErrorBoundary` below, because this is the
	  branch that actually runs. React Router composes the root error element as
	  `<Layout><ErrorBoundary/></Layout>`, and the branch below returns its own
	  fallback without ever rendering `children` - so for a root-level error the
	  `ErrorBoundary` element is created and then discarded, and every
	  `captureException` written inside it was unreachable. `useErrorReport`
	  ignores an absent error, so the normal render path is unaffected.
	*/
	useErrorReport(error)
	const rootLoaderData = useLoaderData<RootLoader>()
	// Only route-derived force-dark is known at render time; the visitor's own
	// preference is applied before paint by ThemeScript (reads the cookie), so it
	// is never baked into this CDN-cached HTML.
	const forceDarkTheme = Boolean(rootLoaderData?.forceDarkTheme)

	if (error) {
		// Extract error message safely
		let errorMessage = 'An unexpected error occurred'
		if (error instanceof Error) {
			errorMessage = error.message
		} else if (typeof error === 'string') {
			errorMessage = error
		} else if (error && typeof error === 'object') {
			errorMessage = JSON.stringify(error, null, 2)
		}

		return (
			<html lang="en" className="dark" style={{ colorScheme: 'dark' }}>
				<head>
					<Meta />
					<Links />
					<CriticalStyles />
					<ThemeScript forceDark={forceDarkTheme} />
				</head>
				<body>
					<div className="error">
						<h1>Something went wrong</h1>
						<pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
							{errorMessage}
						</pre>
					</div>
					<Scripts />
				</body>
			</html>
		)
	}

	return (
		<html
			lang="en"
			suppressHydrationWarning
			className={cn(forceDarkTheme && 'dark')}
			style={{ colorScheme: forceDarkTheme ? 'dark' : 'light' }}
		>
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<Meta />
				<Links />
				<CriticalStyles />
				<ThemeScript forceDark={forceDarkTheme} />
			</head>
			<body>
				<ThemeController />
				<PageViewTracker />
				<GlobalNavigationLoader />
				{children}
				<Toaster toastOptions={{ className: 'rounded-2xl!' }} />
				<ScrollRestoration
					getKey={(location) => `${location.pathname}${location.search}`}
				/>
				<Scripts />
			</body>
		</html>
	)
}

/**
 * The root fallback.
 *
 * `Layout` above short-circuits before rendering this for any error it can see,
 * so in practice this renders only if that changes. It reports through the same
 * hook regardless: a boundary whose reporting depends on which of two branches
 * ran is exactly the arrangement this change exists to remove. The two cannot
 * both report one error, because the branch that renders this is the branch
 * that does not render its own fallback.
 */
export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
	useErrorReport(error)

	let errorMessage = 'An unexpected error occurred'
	if (error instanceof Error) {
		errorMessage = error.message
	} else if (typeof error === 'string') {
		errorMessage = error
	}

	return (
		<div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-8">
			<h1 className="text-2xl font-semibold">Something went wrong</h1>
			<pre className="text-muted-foreground max-w-lg text-sm break-words whitespace-pre-wrap">
				{errorMessage}
			</pre>
		</div>
	)
}

export default function App({ loaderData }: Route.ComponentProps) {
	const { pathname } = useLocation()

	// The provider still wraps everything so consent state resolves (denied by
	// default) everywhere. Only the visible chrome is suppressed, and only where
	// we are rendering inside somebody else's page.
	const consentUiAllowed = shouldRenderConsentUi(pathname)

	return (
		<AuthenticityTokenProvider token={loaderData?.csrf}>
			<ConsentProvider>
				<Outlet />
				{consentUiAllowed ? (
					<>
						<ConsentBanner />
						<ConsentPreferencesDialog />
					</>
				) : null}
			</ConsentProvider>
		</AuthenticityTokenProvider>
	)
}
