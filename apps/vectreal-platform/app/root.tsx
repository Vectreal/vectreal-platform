import { Toaster } from '@vctrl-ui/ui/sonner'
import { cn } from '@vctrl-ui/utils'
import {
	data,
	Links,
	type LinksFunction,
	Meta,
	type MetaFunction,
	Outlet,
	Scripts,
	ScrollRestoration,
	useRouteLoaderData
} from 'react-router'

import { Route } from './+types/root'
import ThemeProvider from './contexts/client.theme-provider'
import { csrfSession } from './sessions/csrf-session.server'
import { getSession } from './sessions/theme-session.server'

import styles from './global.module.css'
import '@vctrl-ui/styles/globals.css'

export const meta: MetaFunction = () => [
	{
		title: 'New Nx React Router App'
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
		return data(loaderData, {
			headers: {
				'Set-Cookie': cookieHeader
			}
		})
	}

	return loaderData
}

export function Layout({ children }: { children: React.ReactNode }) {
	const loaderData = useRouteLoaderData('root')

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
		<ThemeProvider
			defaultTheme={(loaderData?.theme as 'dark') || 'system'}
			storageKey="theme-mode"
		>
			<Outlet />
		</ThemeProvider>
	)
}
