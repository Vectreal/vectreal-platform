import { usePostHog } from '@posthog/react'
import { Toaster } from '@shared/components/ui/sonner'
import { cn } from '@shared/utils'
import { lazy, Suspense, useEffect, type ReactNode } from 'react'
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
import { ClientOnly } from 'remix-utils/client-only'
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
import { posthogMiddleware } from './lib/posthog/posthog-middleware'
import { buildMeta } from './lib/seo'
import {
	buildOrganizationJsonLd,
	buildWebApplicationJsonLd,
	buildWebSiteJsonLd
} from './lib/seo-registry'
import { csrfSession } from './lib/sessions/csrf-session.server'
import styles from './styles/global.module.css'

import type { ShouldRevalidateFunction } from 'react-router'
import '@shared/components/styles/globals.css'

// Lazy-loaded so the workbox-window service-worker registration is only bundled
// for the client. The ClientOnly wrapper below ensures this never renders during SSR.
const PwaUpdateBanner = lazy(
	() => import('./components/pwa-update-banner')
)

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

	const [csrf, cookieHeader] = await csrfSession.commitToken(request)
	// forceDarkTheme is route-derived (not per-visitor), so it stays cache-safe.
	// The visitor's own theme preference is read from the cookie client-side by
	// ThemeScript, never baked into this (CDN-cached) HTML.
	const forceDarkTheme = isForceDarkRoute(pathname)

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
	const rootLoaderData = useLoaderData<RootLoader>()
	// Only route-derived force-dark is known at render time; the visitor's own
	// preference is applied before paint by ThemeScript (reads the cookie), so it
	// is never baked into this CDN-cached HTML.
	const forceDarkTheme = Boolean(rootLoaderData?.forceDarkTheme)

	if (error) {
		console.error('Error in root layout:', error)

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
					<link rel="manifest" href="/site.webmanifest" />
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
			className={cn(styles.global, forceDarkTheme && 'dark')}
			style={{ colorScheme: forceDarkTheme ? 'dark' : 'light' }}
		>
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<Meta />
				<Links />
				<link rel="manifest" href="/site.webmanifest" />
				<CriticalStyles />
				<ThemeScript forceDark={forceDarkTheme} />
			</head>
			<body>
				<ThemeController />
				<PageViewTracker />
				<GlobalNavigationLoader />
				{children}
				<Toaster toastOptions={{ className: 'rounded-2xl!' }} />
				<ClientOnly fallback={null}>
					{() => (
						<Suspense fallback={null}>
							<PwaUpdateBanner />
						</Suspense>
					)}
				</ClientOnly>
				<ScrollRestoration
					getKey={(location) => `${location.pathname}${location.search}`}
				/>
				<Scripts />
			</body>
		</html>
	)
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
	const posthog = usePostHog()
	posthog?.captureException(error as Error)

	let errorMessage = 'An unexpected error occurred'
	if (error instanceof Error) {
		errorMessage = error.message
	} else if (typeof error === 'string') {
		errorMessage = error
	}

	return (
		<div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
			<h1 className="text-2xl font-semibold">Something went wrong</h1>
			<pre className="text-muted-foreground max-w-lg text-sm break-words whitespace-pre-wrap">
				{errorMessage}
			</pre>
		</div>
	)
}

export default function App({ loaderData }: Route.ComponentProps) {
	return (
		<AuthenticityTokenProvider token={loaderData?.csrf}>
			<ConsentProvider>
				<Outlet />
				<ConsentBanner />
				<ConsentPreferencesDialog />
			</ConsentProvider>
		</AuthenticityTokenProvider>
	)
}
