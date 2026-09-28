/**
 * Whether this process talks to PostHog at all, for the browser and the server
 * alike. There is one PostHog project, so anything that says yes here reports
 * into production.
 *
 * `VITE_PUBLIC_POSTHOG_ENABLED` decides whenever it is set: `'false'` keeps a
 * machine out even when it holds the token, `'true'` lets it in. Unset, a
 * production build reports and a development build does not.
 *
 * The flag has to win over the build mode because the build mode does not say
 * where the code runs. `nx build` and `nx start` produce a production build on
 * a laptop, loaded with the laptop's `.env.development`, and the tsx
 * maintenance scripts run with no Vite at all. The build mode is only the
 * default, which keeps production reporting without a flag to forget: the
 * server client has silently been `null` in production once before, and the
 * checkout kill switch and the error sink both depend on it.
 *
 * Pure, so each side passes in what it can read. The browser reads the flag
 * baked into its bundle; the server reads it from the environment it was
 * started with, so a local `false` holds for a production build run locally.
 */
export function isPosthogEnabled({
	dev,
	flag
}: {
	dev: boolean
	flag: string | undefined
}): boolean {
	if (flag === 'false') return false
	if (flag === 'true') return true
	return !dev
}
