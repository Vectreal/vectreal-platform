/**
 * Which deployment a report comes from, so error tracking can tell production,
 * staging and somebody's laptop apart.
 *
 * There is one PostHog project for all of them. Before this, an exception from
 * a dev server in a worktree landed next to one from production with nothing
 * to tell them apart, and every issue had to be traced by hand.
 *
 * Pure and isomorphic: each sink reads what it can and passes it in. The server
 * knows which Fly app it runs as (`FLY_APP_NAME`, set by Fly on every machine);
 * the browser only knows the host that served the page. Both map onto the same
 * two Fly apps below, so neither needs a setting of its own.
 */

export type DeploymentEnvironment = 'production' | 'staging' | 'development'

/** The Fly apps, as `fly.toml` and `fly.staging.toml` name them. */
const FLY_APPS: Record<string, DeploymentEnvironment> = {
	'vectreal-platform': 'production',
	'vectreal-platform-staging': 'staging'
}

/** The hosts each app answers on: its own domain, and Fly's. */
const HOSTS: Record<string, DeploymentEnvironment> = {
	'vectreal.com': 'production',
	'www.vectreal.com': 'production',
	'staging.vectreal.com': 'staging',
	...Object.fromEntries(
		Object.entries(FLY_APPS).map(([app, environment]) => [
			`${app}.fly.dev`,
			environment
		])
	)
}

/*
  Anything that is not one of the two deployments is development: a dev
  server, `nx start` on a laptop, a test run. Unknown means "not ours", and
  that is the one environment allowed to stay quiet (see `sendsExceptions`).
*/
function lookup(
	table: Record<string, DeploymentEnvironment>,
	key: string | undefined
): DeploymentEnvironment {
	return key !== undefined && Object.hasOwn(table, key)
		? table[key]
		: 'development'
}

/** The server's environment, from `process.env.FLY_APP_NAME`. */
export function environmentFromFlyApp(
	app: string | undefined
): DeploymentEnvironment {
	return lookup(FLY_APPS, app)
}

/** The browser's environment, from `window.location.hostname`. */
export function environmentFromHostname(
	hostname: string
): DeploymentEnvironment {
	return lookup(HOSTS, hostname.toLowerCase())
}

/**
 * Whether exceptions from this environment go to PostHog at all.
 *
 * Development keeps them on the machine: the server sink still logs them and
 * the browser shows them in its console. Tagging them and filtering later
 * would leave every alert, dashboard and issue list one forgotten filter away
 * from a developer's half-finished branch, and PostHog would still open an
 * issue for each. Dropped at the source, there is nothing to filter.
 */
export function sendsExceptions(environment: DeploymentEnvironment): boolean {
	return environment !== 'development'
}

/**
 * The tags every exception carries: where it came from, and from which build.
 *
 * `release` is the commit the image was built from. The deploy workflow passes
 * it to the Docker build, which bakes it into both bundles as
 * `VITE_PUBLIC_RELEASE`; a build without it (anything local) sends none rather
 * than a placeholder that would read as a real version. Optional chaining
 * because the tsx maintenance scripts reach the server sink with no Vite,
 * where `import.meta.env` does not exist.
 */
export function deploymentProperties(environment: DeploymentEnvironment): {
	environment: DeploymentEnvironment
	release?: string
} {
	const release: unknown = import.meta.env?.VITE_PUBLIC_RELEASE
	return typeof release === 'string' && release !== ''
		? { environment, release }
		: { environment }
}
