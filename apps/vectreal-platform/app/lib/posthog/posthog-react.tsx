import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useState,
	useSyncExternalStore
} from 'react'

import { applyAnalyticsConsent } from './analytics-consent'

import type { PostHog } from 'posthog-js'

/**
 * The app's PostHog context, in place of `@posthog/react`.
 *
 * `@posthog/react` imports `posthog-js` statically for its default context
 * value, so any component using its hooks put the whole library on every
 * page, `/embed` included. Here the library arrives through `loadPostHog()`
 * (`posthog-browser.ts`), after hydration.
 *
 * Components get a client from their first render anyway. Until the library
 * has loaded it queues every call, then replays the queue in order, so what
 * a page does in its first second (a pageview, a consent choice, an error, a
 * logout) reaches PostHog in the order it would have with the library
 * already there. Where PostHog never starts, the queue is dropped and every
 * call does nothing. On the server there is no provider, and `usePostHog()`
 * is `undefined`.
 */

const METHODS = [
	'capture',
	'captureException',
	'identify',
	'group',
	'reset'
] as const

type Method = (typeof METHODS)[number]

/**
 * The calls the app makes. None answers: a queued call has nothing to say.
 *
 * Consent goes through `setAnalyticsConsent` (`analytics-consent.ts`)
 * rather than PostHog's own opt-in and opt-out, so no component can store a
 * refusal on the device of a visitor who declined.
 */
export type PostHogClient = {
	[M in Method]: (...args: Parameters<PostHog[M]>) => void
} & { setAnalyticsConsent: (granted: boolean) => void }

/*
  posthog-js reads the time and the page when an event is sent, so a queued
  event would otherwise carry the replay's: a visitor who navigates before
  the library arrives would see the first page's pageview filed under the
  second. The values are taken now instead; explicit properties win over
  the ones posthog-js computes, and the caller's own still win over these.
*/
function atCallTime(method: Method, args: unknown[]): unknown[] {
	if (method !== 'capture' && method !== 'captureException') return args
	const [subject, properties, options] = args as [
		unknown,
		Record<string, unknown> | undefined,
		Record<string, unknown> | undefined
	]
	const page = {
		$current_url: window.location.href,
		$host: window.location.host,
		$pathname: window.location.pathname,
		...properties
	}
	return method === 'capture'
		? [subject, page, { timestamp: new Date(), ...options }]
		: [subject, page]
}

export function deferPostHog(load: Promise<PostHog | undefined>): {
	client: PostHogClient
	loaded: Promise<PostHog | undefined>
} {
	type Call = { name: string; run: (posthog: PostHog) => void }
	let target: PostHog | undefined
	let queue: Call[] | undefined = []

	const loaded = load.then((posthog) => {
		const pending = queue ?? []
		queue = undefined
		target = posthog
		if (posthog)
			for (const { name, run } of pending) {
				/*
				  One call failing (Safari throws on storage with site data
				  blocked) must not take the rest of the queue with it.
				*/
				try {
					run(posthog)
				} catch (error) {
					console.error(`PostHog ${name} failed.`, error)
				}
			}
		return posthog
	})

	const send = (call: Call) => {
		if (target) call.run(target)
		else queue?.push(call)
	}

	const client = {
		...Object.fromEntries(
			METHODS.map((method) => [
				method,
				(...args: unknown[]) => {
					const queued = target ? args : atCallTime(method, args)
					send({
						name: method,
						run: (posthog) =>
							(posthog[method] as (...args: unknown[]) => unknown).apply(
								posthog,
								queued
							)
					})
				}
			])
		),
		setAnalyticsConsent: (granted: boolean) =>
			send({
				name: 'setAnalyticsConsent',
				run: (posthog) => applyAnalyticsConsent(posthog, granted)
			})
	} as PostHogClient

	return { client, loaded }
}

const PostHogContext = createContext<
	{ client: PostHogClient; loaded: PostHog | undefined } | undefined
>(undefined)

export function PostHogProvider({
	client,
	children
}: {
	client: Promise<PostHog | undefined>
	children: ReactNode
}) {
	const [deferred] = useState(() => deferPostHog(client))
	const [loaded, setLoaded] = useState<PostHog | undefined>(undefined)

	useEffect(() => {
		let current = true
		void deferred.loaded.then((posthog) => {
			if (current) setLoaded(posthog)
		})
		return () => {
			current = false
		}
	}, [deferred])

	return (
		<PostHogContext.Provider value={{ client: deferred.client, loaded }}>
			{children}
		</PostHogContext.Provider>
	)
}

export function usePostHog(): PostHogClient | undefined {
	return useContext(PostHogContext)?.client
}

/**
 * A feature flag's value, `undefined` until PostHog has loaded and
 * evaluated it. A value cannot be queued, so this reads the loaded library.
 */
export function useFeatureFlagEnabled(flag: string): boolean | undefined {
	const posthog = useContext(PostHogContext)?.loaded

	const subscribe = useCallback(
		(onChange: () => void) => posthog?.onFeatureFlags(onChange) ?? (() => {}),
		[posthog]
	)

	return useSyncExternalStore(
		subscribe,
		() => posthog?.isFeatureEnabled(flag),
		() => undefined
	)
}
