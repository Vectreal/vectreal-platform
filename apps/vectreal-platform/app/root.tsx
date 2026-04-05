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
import {
	ConsentProvider,
	type ConsentChoices
} from './components/consent/consent-context'
import { ConsentPreferencesDialog } from './components/consent/consent-preferences-dialog'
import { GlobalNavigationLoader } from './components/global-navigation-loader'
import { getConsent } from './lib/domain/consent/consent-repository.server'
import { posthogMiddleware } from './lib/posthog/posthog-middleware'
import { getSession as getConsentSession } from './lib/sessions/consent-session.server'
import { csrfSession } from './lib/sessions/csrf-session.server'
import {
	getThemeModeFromRequest,
	type ThemeMode
} from './lib/sessions/theme-session.server'
import { createSupabaseClient } from './lib/supabase.server'
import styles from './styles/global.module.css'

import type { ShouldRevalidateFunction } from 'react-router'
import '@shared/components/styles/globals.css'

export const meta: MetaFunction = () => [
	{ title: 'Vectreal - Your platform for creating and sharing 3D scenes.' },
	{
		name: 'description',
		content:
			'Vectreal is your go-to platform for creating, sharing, and exploring stunning 3D scenes. Join our community of creators and bring your virtual visions to life!'
	}
]

export const middleware: Route.MiddlewareFunction[] = [posthogMiddleware]

export async function loader({ request }: Route.LoaderArgs) {
	const [csrf, cookieHeader] = await csrfSession.commitToken(request)
	const pathname = new URL(request.url).pathname
	const forceDarkTheme = pathname === '/' || pathname === '/home'
	const themeMode = await getThemeModeFromRequest(request)

	// Resolve consent state for the current visitor
	const { client } = await createSupabaseClient(request)
	const {
		data: { user }
	} = await client.auth.getUser()
	const consentSession = await getConsentSession(request.headers.get('Cookie'))
	const anonymousId = consentSession.get('anonymousId') ?? null
	const consentRecord = await getConsent(user?.id ?? null, anonymousId).catch(
		() => null
	)

	const consentState: ConsentChoices | null = consentRecord
		? {
				necessary: true,
				functional: consentRecord.functional,
				analytics: consentRecord.analytics,
				marketing: consentRecord.marketing
			}
		: null

	const loaderData = {
		csrf,
		themeMode,
		forceDarkTheme,
		consentState,
		consentVersion: consentRecord?.version ?? null
	}

	if (cookieHeader) {
		return data(loaderData, { headers: { 'Set-Cookie': cookieHeader } })
	}

	return loaderData
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

function applyResolvedTheme(
	themeMode: ThemeMode,
	forceDarkTheme: boolean
): void {
	if (typeof document === 'undefined') {
		return
	}

	const root = document.documentElement
	const prefersDark =
		typeof window !== 'undefined' &&
		window.matchMedia('(prefers-color-scheme: dark)').matches
	const shouldUseDark =
		forceDarkTheme ||
		themeMode === 'dark' ||
		(themeMode === 'system' && prefersDark)

	root.classList.toggle('dark', shouldUseDark)
	root.style.colorScheme = shouldUseDark ? 'dark' : 'light'
}

function ThemeManager({ themeMode }: { themeMode: ThemeMode }) {
	const location = useLocation()

	useEffect(() => {
		const forceDarkTheme =
			location.pathname === '/' || location.pathname === '/home'
		applyResolvedTheme(themeMode, forceDarkTheme)

		if (forceDarkTheme || themeMode !== 'system') {
			return
		}

		const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
		const handleChange = () => {
			applyResolvedTheme('system', false)
		}

		mediaQuery.addEventListener('change', handleChange)

		return () => {
			mediaQuery.removeEventListener('change', handleChange)
		}
	}, [location.pathname, themeMode])

	return null
}

function ThemeInitScript({
	themeMode,
	forceDarkTheme
}: {
	themeMode: ThemeMode
	forceDarkTheme: boolean
}) {
	const script = `(() => {
  const root = document.documentElement;
  const forceDarkTheme = ${JSON.stringify(forceDarkTheme)};
  const themeMode = ${JSON.stringify(themeMode)};
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const shouldUseDark = forceDarkTheme || themeMode === 'dark' || (themeMode === 'system' && prefersDark);
  root.classList.toggle('dark', shouldUseDark);
  root.style.colorScheme = shouldUseDark ? 'dark' : 'light';
})();`

	return <script dangerouslySetInnerHTML={{ __html: script }} />
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
	const themeMode: ThemeMode = rootLoaderData?.themeMode ?? 'system'
	const forceDarkTheme = Boolean(rootLoaderData?.forceDarkTheme)
	const initialShouldUseDark = forceDarkTheme || themeMode === 'dark'

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
					<CriticalStyles />
					<ThemeInitScript
						themeMode={themeMode}
						forceDarkTheme={forceDarkTheme}
					/>
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
			className={cn(styles.global, initialShouldUseDark && 'dark')}
			style={{ colorScheme: initialShouldUseDark ? 'dark' : 'light' }}
		>
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<Meta />
				<Links />
				<CriticalStyles />
				<ThemeInitScript
					themeMode={themeMode}
					forceDarkTheme={forceDarkTheme}
				/>
			</head>
			<body>
				<ThemeManager themeMode={themeMode} />
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
	const consentState = loaderData?.consentState ?? null
	const consentVersion = loaderData?.consentVersion ?? null

	return (
		<AuthenticityTokenProvider token={loaderData?.csrf}>
			<ConsentProvider
				initialConsent={consentState}
				initialVersion={consentVersion}
			>
				<Outlet />
				<ConsentBanner />
				<ConsentPreferencesDialog />
			</ConsentProvider>
		</AuthenticityTokenProvider>
	)
}
