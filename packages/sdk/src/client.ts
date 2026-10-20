import { cliClientSchema, type CliClient } from './cli-client'
import {
	allowedDomainsSchema,
	createdEmbedKeySchema,
	embedKeyListSchema,
	sceneEmbedSchema,
	type AllowedDomains,
	type CreatedEmbedKey,
	type CreateEmbedKeyInput,
	type EmbedKeyList,
	type SceneEmbed,
	type SetAllowedDomainsInput
} from './embed'
import { apiFailureSchema, apiSuccessSchema, type ApiFailure } from './envelope'
import { meSchema, type Me } from './me'
import {
	createdProjectSchema,
	projectListSchema,
	type CreatedProject,
	type CreateProjectInput,
	type ProjectList
} from './projects'
import {
	createdSceneSchema,
	scenePublicationSchema,
	type CreatedScene,
	type CreateSceneInput,
	type PublishSceneInput,
	type ScenePublication
} from './scenes'
import { endedSessionSchema, type EndedSession } from './session'

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

	async function send<Data extends z.ZodType>(
		method: 'GET' | 'POST' | 'PUT' | 'DELETE',
		path: string,
		data: Data,
		{
			auth,
			body: payload,
			headers: extraHeaders
		}: {
			auth: 'bearer' | 'public'
			body?: unknown
			headers?: Record<string, string>
		}
	): Promise<z.infer<Data>> {
		const headers = new Headers({ Accept: 'application/json', ...extraHeaders })
		// A FormData body leaves Content-Type to fetch, which adds the boundary.
		const isForm = payload instanceof FormData
		if (payload !== undefined && !isForm) {
			headers.set('Content-Type', 'application/json')
		}
		if (auth === 'bearer') {
			if (!getAccessToken) {
				throw new Error(`${path} needs an access token: pass getAccessToken`)
			}
			headers.set('Authorization', `Bearer ${await getAccessToken()}`)
		}

		const response = await fetch(new URL(path, base), {
			method,
			headers,
			body: payload === undefined || isForm ? payload : JSON.stringify(payload)
		})

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
		me: (): Promise<Me> =>
			send('GET', 'api/v1/me', meSchema, { auth: 'bearer' }),
		/** The projects in the organization the token's grant names. */
		projects: (): Promise<ProjectList> =>
			send('GET', 'api/v1/projects', projectListSchema, { auth: 'bearer' }),
		/**
		 * Creates a project in the grant's organization.
		 *
		 * To retry safely after a timeout, pass your own `idempotencyKey` and
		 * send it again unchanged: the server answers with the first outcome for
		 * a day instead of creating a second project. Without one, each call
		 * gets a fresh key and is a new operation.
		 */
		createProject: (
			input: CreateProjectInput,
			{ idempotencyKey = crypto.randomUUID() }: { idempotencyKey?: string } = {}
		): Promise<CreatedProject> =>
			send('POST', 'api/v1/projects', createdProjectSchema, {
				auth: 'bearer',
				body: input,
				headers: { 'Idempotency-Key': sfString(idempotencyKey) }
			}),
		/**
		 * Creates a scene in a project from one GLB, stored as it is: nothing is
		 * re-encoded, so compress it before sending if it should be smaller.
		 *
		 * Retrying works as for `createProject`: pass your own `idempotencyKey`
		 * and send the same name and file again.
		 */
		createScene: (
			projectId: string,
			{ file, name }: CreateSceneInput,
			{ idempotencyKey = crypto.randomUUID() }: { idempotencyKey?: string } = {}
		): Promise<CreatedScene> => {
			const form = new FormData()
			form.set('name', name)
			form.set('file', file)
			return send(
				'POST',
				`api/v1/projects/${encodeURIComponent(projectId)}/scenes`,
				createdSceneSchema,
				{
					auth: 'bearer',
					body: form,
					headers: { 'Idempotency-Key': sfString(idempotencyKey) }
				}
			)
		},
		/**
		 * Publishes a scene with the GLB visitors will load. Nothing is
		 * re-encoded on the server, so send the compressed export (Draco, KTX2),
		 * as the publisher does. Publishing again replaces the GLB.
		 */
		publishScene: (
			sceneId: string,
			{ file }: PublishSceneInput,
			{ idempotencyKey = crypto.randomUUID() }: { idempotencyKey?: string } = {}
		): Promise<ScenePublication> => {
			const form = new FormData()
			form.set('file', file)
			return send(
				'POST',
				`api/v1/scenes/${encodeURIComponent(sceneId)}/publication`,
				scenePublicationSchema,
				{
					auth: 'bearer',
					body: form,
					headers: { 'Idempotency-Key': sfString(idempotencyKey) }
				}
			)
		},
		/** Takes a scene offline. A scene that was not published stays a draft. */
		unpublishScene: (
			sceneId: string,
			{ idempotencyKey = crypto.randomUUID() }: { idempotencyKey?: string } = {}
		): Promise<ScenePublication> =>
			send(
				'DELETE',
				`api/v1/scenes/${encodeURIComponent(sceneId)}/publication`,
				scenePublicationSchema,
				{
					auth: 'bearer',
					headers: { 'Idempotency-Key': sfString(idempotencyKey) }
				}
			),
		/** A project's embed keys, usable first. Tokens are not included. */
		listEmbedKeys: (projectId: string): Promise<EmbedKeyList> =>
			send(
				'GET',
				`api/v1/projects/${encodeURIComponent(projectId)}/embed-keys`,
				embedKeyListSchema,
				{ auth: 'bearer' }
			),
		/**
		 * Creates an embed key for one project; it expires after 90 days. The
		 * answer names the key but carries no token: `getSceneEmbed` puts it in
		 * the snippet.
		 */
		createEmbedKey: (
			projectId: string,
			input: CreateEmbedKeyInput,
			{ idempotencyKey = crypto.randomUUID() }: { idempotencyKey?: string } = {}
		): Promise<CreatedEmbedKey> =>
			send(
				'POST',
				`api/v1/projects/${encodeURIComponent(projectId)}/embed-keys`,
				createdEmbedKeySchema,
				{
					auth: 'bearer',
					body: input,
					headers: { 'Idempotency-Key': sfString(idempotencyKey) }
				}
			),
		/** The sites that may show a project's embeds. */
		getAllowedDomains: (projectId: string): Promise<AllowedDomains> =>
			send(
				'GET',
				`api/v1/projects/${encodeURIComponent(projectId)}/allowed-domains`,
				allowedDomainsSchema,
				{ auth: 'bearer' }
			),
		/**
		 * Replaces the sites that may show a project's embeds, and answers with
		 * the list as stored. Send the whole list: one left out stops working.
		 */
		setAllowedDomains: (
			projectId: string,
			input: SetAllowedDomainsInput,
			{ idempotencyKey = crypto.randomUUID() }: { idempotencyKey?: string } = {}
		): Promise<AllowedDomains> =>
			send(
				'PUT',
				`api/v1/projects/${encodeURIComponent(projectId)}/allowed-domains`,
				allowedDomainsSchema,
				{
					auth: 'bearer',
					body: input,
					headers: { 'Idempotency-Key': sfString(idempotencyKey) }
				}
			),
		/**
		 * The embed for a published scene, token included: the iframe URL and
		 * two snippets to paste. Uses `keyId` when given, else the project's best
		 * usable key.
		 */
		getSceneEmbed: (
			sceneId: string,
			{ keyId }: { keyId?: string } = {}
		): Promise<SceneEmbed> => {
			const query = keyId ? `?${new URLSearchParams({ keyId })}` : ''
			return send(
				'GET',
				`api/v1/scenes/${encodeURIComponent(sceneId)}/embed${query}`,
				sceneEmbedSchema,
				{ auth: 'bearer' }
			)
		},
		/**
		 * Ends the session the token belongs to: it and its refresh token stop
		 * working. The agent's grant stays; revoking it is the dashboard's job.
		 */
		endSession: (): Promise<EndedSession> =>
			send('DELETE', 'api/v1/session', endedSessionSchema, { auth: 'bearer' }),
		/** How the CLI signs in against this origin. */
		cliClient: (): Promise<CliClient> =>
			send('GET', 'api/v1/cli/client', cliClientSchema, { auth: 'public' })
	}
}

export type VectrealClient = ReturnType<typeof createVectrealClient>

/** An RFC 8941 String, which is what `Idempotency-Key` carries. */
function sfString(value: string): string {
	return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}
