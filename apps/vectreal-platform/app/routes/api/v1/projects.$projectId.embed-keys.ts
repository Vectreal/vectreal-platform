/**
 * GET  /api/v1/projects/:projectId/embed-keys  the project's embed keys,
 *                                              usable first.
 * POST /api/v1/projects/:projectId/embed-keys  creates one from
 *                                              `{ "name": "…" }`, expiring in
 *                                              90 days. Needs an
 *                                              `Idempotency-Key`; answers 201
 *                                              `{ embedKey }`.
 *
 * Both need `embed:manage`. Neither answer carries a token: a kept response
 * is stored as sent for a day, so the token travels only in
 * `GET /api/v1/scenes/:sceneId/embed`, which is never kept.
 */

import { ApiResponse } from '@shared/utils'
import { createEmbedKeyInputSchema } from '@vctrl/sdk'

import {
	agentApiError,
	agentBillingRefusal
} from '../../../lib/domain/agent/agent-api-response'
import { recordAgentAudit } from '../../../lib/domain/agent/agent-audit.server'
import { withIdempotency } from '../../../lib/domain/agent/agent-idempotency.server'
import { AGENT_OPERATION_SCOPES } from '../../../lib/domain/agent/agent-operation-scopes'
import { authorizeAgentRequest } from '../../../lib/domain/agent/agent-request.server'
import { resolveAgentProject } from '../../../lib/domain/agent/agent-resource.server'
import {
	createApiKey,
	getAllUserApiKeys
} from '../../../lib/domain/auth/api-key-repository.server'
import { resolveApiKeyValue } from '../../../lib/domain/auth/api-key-value.server'
import {
	isEmbedKeyUsable,
	toEmbedApiKeyOptions,
	type EmbedApiKeyOption
} from '../../../lib/domain/embed/embed-key-options'

import type { Route } from './+types/projects.$projectId.embed-keys'
import type { CreatedEmbedKey, EmbedKey, EmbedKeyList } from '@vctrl/sdk'

/** The dashboard embed panel's default, so both mint the same key. */
const EXPIRY_DAYS = 90

export async function loader({ request, params }: Route.LoaderArgs) {
	const actor = await authorizeAgentRequest(request, {
		scope: AGENT_OPERATION_SCOPES['api-key:read']
	})
	const { projectId } = await resolveAgentProject(
		params.projectId,
		actor,
		'api-key:read'
	)

	const now = new Date()
	const keys = await getAllUserApiKeys(actor.userId)
	/*
	  Decrypted only to sort and to say which keys can build a snippet: a key
	  whose token cannot be read back is not usable, and nothing else tells.
	  The value is dropped before the answer is built.
	*/
	const options = toEmbedApiKeyOptions(
		keys
			.filter((key) => key.projects.some((scoped) => scoped.id === projectId))
			.map((key) => {
				const resolved = resolveApiKeyValue(key.apiKey, now)
				return { ...key, value: resolved.readable ? resolved.value : null }
			}),
		projectId,
		now
	)

	return ApiResponse.success(
		{ embedKeys: options.map(toEmbedKey) } satisfies EmbedKeyList,
		200,
		{ headers: { 'Cache-Control': 'no-store' } }
	)
}

export async function action({ request, params }: Route.ActionArgs) {
	const actor = await authorizeAgentRequest(request, {
		scope: AGENT_OPERATION_SCOPES['api-key:create']
	})
	if (request.method !== 'POST') {
		return agentApiError(
			405,
			'method_not_allowed',
			'This route answers GET and POST.',
			{ headers: { Allow: 'GET, POST' } }
		)
	}

	const { projectId } = await resolveAgentProject(
		params.projectId,
		actor,
		'api-key:create'
	)

	const payload: unknown = await request.json().catch(() => undefined)
	const input = createEmbedKeyInputSchema.safeParse(payload)
	if (!input.success) {
		throw agentApiError(
			400,
			'invalid_request',
			'Send a JSON body like {"name": "Shop product page"}, with a name of 1 to 100 characters.',
			{ extra: { issues: input.error.issues } }
		)
	}
	const { name } = input.data

	return withIdempotency(
		{ grantId: actor.grantId, request, payload: { projectId, name } },
		async (tx) => {
			const expiresAt = new Date()
			expiresAt.setDate(expiresAt.getDate() + EXPIRY_DAYS)

			try {
				const created = await createApiKey(
					{
						userId: actor.userId,
						organizationId: actor.organizationId,
						name,
						description: 'Created by an agent through the Vectreal API.',
						projectIds: [projectId],
						expiresAt
					},
					tx
				)
				await recordAgentAudit(tx, actor, 'api-key:create', created.apiKey.id)

				const [option] = toEmbedApiKeyOptions(
					[
						{
							apiKey: created.apiKey,
							projects: [{ id: projectId }],
							value: created.plaintext
						}
					],
					projectId,
					new Date()
				)
				return ApiResponse.success(
					{ embedKey: toEmbedKey(option) } satisfies CreatedEmbedKey,
					201,
					{ headers: { 'Cache-Control': 'no-store' } }
				)
			} catch (error) {
				const refusal = agentBillingRefusal(error, request)
				if (!refusal) throw error
				return refusal
			}
		}
	)
}

/** The option without its token. */
function toEmbedKey(option: EmbedApiKeyOption): EmbedKey {
	const { value: _value, ...metadata } = option
	return { ...metadata, usable: isEmbedKeyUsable(option) }
}
