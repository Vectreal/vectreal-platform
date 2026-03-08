import { Toaster } from '@shared/components/ui/sonner'
import { cn } from '@shared/utils'
import {
	data,
	Links,
	Meta,
	type MetaFunction,
	Outlet,
	Scripts,
	ScrollRestoration,
	useRouteError
} from 'react-router'
import { AuthenticityTokenProvider } from 'remix-utils/csrf/react'

import { Route } from './+types/root'
import { GlobalNavigationLoader } from './components/global-navigation-loader'
import { csrfSession } from './lib/sessions/csrf-session.server'
import styles from './styles/global.module.css'

import type { ReactNode } from 'react'
import type { ShouldRevalidateFunction } from 'react-router'
import '@shared/components/styles/globals.css'

export const meta: MetaFunction = () => [
	{
		title: 'Vectreal Platform',
		name: 'description',
		content: 'Your platform for creating and sharing 3D content.'
	}
]

export async function loader({ request }: Route.LoaderArgs) {
	const [csrf, cookieHeader] = await csrfSession.commitToken(request)
	const loaderData = { csrf }

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

const CriticalStyles = () => (
	<style>
		{`/* Critical CSS for initial render */
			body {
				font-family: 'Inter', sans-serif;
			}
			
			button, a {
				cursor: pointer;
			}
	`}
	</style>
)

export function Layout({ children }: { children: ReactNode }) {
	const error = useRouteError()

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
			className={cn(styles.global, 'dark')}
			style={{ colorScheme: 'dark' }}
		>
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<Meta />
				<Links />
				<CriticalStyles />
			</head>
			<body>
				<GlobalNavigationLoader />
				{children}
				<Toaster toastOptions={{ className: 'rounded-2xl!' }} />
				<ScrollRestoration />
				<Scripts />
			</body>
		</html>
	)
}

export default function App({ loaderData }: Route.ComponentProps) {
	return (
		<AuthenticityTokenProvider token={loaderData?.csrf}>
			<Outlet />
		</AuthenticityTokenProvider>
	)
}
