import { Toaster } from '@shared/components/ui/sonner'
import { cn } from '@shared/utils'
import {
	data,
	Links,
	type LinksFunction,
	Meta,
	type MetaFunction,
	Outlet,
	Scripts,
	ScrollRestoration,
	useRouteError,
	useRouteLoaderData
} from 'react-router'
import { AuthenticityTokenProvider } from 'remix-utils/csrf/react'

import { Route } from './+types/root'
import ThemeProvider from './contexts/theme-provider'
import { csrfSession } from './lib/sessions/csrf-session.server'
import { getSession } from './lib/sessions/theme-session.server'

import styles from './styles/global.module.css'
import '@shared/components/styles/globals.css'

export const meta: MetaFunction = () => [
	{
		title: 'Vectreal Platform',
		name: 'description',
		content: 'Your platform for creating and sharing 3D content.'
	}
]

export const links: LinksFunction = () => [
	{ rel: 'preconnect', href: 'https://fonts.googleapis.com' },
	{
		rel: 'preconnect',
		href: 'https://fonts.gstatic.com',
		crossOrigin: 'anonymous'
	},
	{
		rel: 'stylesheet',
		href: 'https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&display=swap'
	}
]

export async function loader({ request }: Route.LoaderArgs) {
	const [csrf, cookieHeader] = await csrfSession.commitToken(request)
	const session = await getSession(request.headers.get('Cookie'))
	const theme = session.get('themeMode') || 'system'
	const loaderData = { csrf, theme }

	if (cookieHeader) {
		return data(loaderData, { headers: { 'Set-Cookie': cookieHeader } })
	}

	return loaderData
}

export type RootLoader = typeof loader

export function Layout({ children }: { children: React.ReactNode }) {
	const loaderData = useRouteLoaderData('root')
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
			<html lang="en">
				<head>
					<Meta />
					<Links />
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
		<html lang="en" className={cn(styles.global, loaderData?.theme || 'dark')}>
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<Meta />
				<Links />
			</head>
			<body>
				{children}
				<Toaster />
				<ScrollRestoration />
				<Scripts />
			</body>
		</html>
	)
}

export default function App({ loaderData }: Route.ComponentProps) {
	return (
		<AuthenticityTokenProvider token={loaderData?.csrf}>
			<ThemeProvider
				defaultTheme={(loaderData?.theme as 'dark') || 'system'}
				storageKey="theme-mode"
			>
				<Outlet />
			</ThemeProvider>
		</AuthenticityTokenProvider>
	)
}
