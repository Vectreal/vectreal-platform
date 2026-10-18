import { cliClientSchema, type CliClient } from './cli-client'
import { apiFailureSchema, apiSuccessSchema, type ApiFailure } from './envelope'
import { meSchema, type Me } from './me'
import { projectListSchema, type ProjectList } from './projects'

import type { z } from 'zod'

/**
 * The server refused, or failed: its status and its message. `body` is the
 * whole failure envelope when there was one, so fields the server adds, such
 * as `quota` on a plan limit, reach the caller.
 */
export class VectrealApiError extends Error {
	override readonly name = 'VectrealApiError'

	constructor(
		readonly status: number,
		message: string,
		readonly body?: ApiFailure
	) {
		super(message)
	}

	/** What to branch on: one of `API_ERROR_CODES`, or a newer one. */
	get code(): string | undefined {
		return this.body?.code
	}
}

/**
 * The server answered with a body this client cannot read: a server newer or
 * older than the client, or an origin that is not a Vectreal server. Kept
 * apart from `VectrealApiError` so a version skew is never reported as a
 * refusal, and a server failure never as a version skew.
 */
export class VectrealContractError extends Error {
	override readonly name = 'VectrealContractError'

	constructor(
		readonly status: number,
		message: string,
		readonly issues: readonly z.core.$ZodIssue[] = []
	) {
		super(message)
	}
}

export interface VectrealClientOptions {
	/** Where Vectreal is served, for example `https://vectreal.com`. */
	baseUrl: string
	/** The agent's OAuth access token. Not needed for public calls. */
	getAccessToken?: () => string | Promise<string>
	fetch?: typeof globalThis.fetch
}

export function createVectrealClient({
	baseUrl,
	getAccessToken,
	fetch = globalThis.fetch
}: VectrealClientOptions) {
	// Relative paths against a base ending in `/`, so a base with a path keeps it.
	const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`

	async function get<Data extends z.ZodType>(
		path: string,
		data: Data,
		auth: 'bearer' | 'public'
	): Promise<z.infer<Data>> {
		const headers = new Headers({ Accept: 'application/json' })
		if (auth === 'bearer') {
			if (!getAccessToken) {
				throw new Error(`${path} needs an access token: pass getAccessToken`)
			}
			headers.set('Authorization', `Bearer ${await getAccessToken()}`)
		}

		const response = await fetch(new URL(path, base), { headers })

		const body: unknown = await response.json().catch(() => undefined)

		const failure = apiFailureSchema.safeParse(body)
		if (failure.success) {
			throw new VectrealApiError(
				response.status,
				failure.data.error,
				failure.data
			)
		}

		// A failure outside the envelope: an error thrown past a route, a rate
		// limiter, a proxy's error page. Only a 404 without one says the route
		// does not exist, which is a server older than this client.
		if (!response.ok) {
			const message = `${path} answered ${response.status}`
			throw response.status === 404
				? new VectrealContractError(response.status, message)
				: new VectrealApiError(response.status, message)
		}

		const success = apiSuccessSchema(data).safeParse(body)
		if (!success.success) {
			throw new VectrealContractError(
				response.status,
				`${path} answered with a body this client does not understand`,
				success.error.issues
			)
		}

		// zod cannot resolve a property of an object built from a generic schema.
		return (success.data as { data: z.infer<Data> }).data
	}

	return {
		/** Who the access token acts as. */
		me: (): Promise<Me> => get('api/v1/me', meSchema, 'bearer'),
		/** The projects in the organization the token's grant names. */
		projects: (): Promise<ProjectList> =>
			get('api/v1/projects', projectListSchema, 'bearer'),
		/** How the CLI signs in against this origin. */
		cliClient: (): Promise<CliClient> =>
			get('api/v1/cli/client', cliClientSchema, 'public')
	}
}

export type VectrealClient = ReturnType<typeof createVectrealClient>
