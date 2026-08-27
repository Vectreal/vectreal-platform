/**
 * The embed panel's view of one project's API keys.
 *
 * The panel is mounted from two places with very different data plumbing - the
 * dashboard scene route's loader already holds the project row, while the
 * publisher would need a four-file thread-through to reach it - so the panel
 * fetches for itself against this route rather than either mount site growing
 * props it cannot supply.
 *
 * The loader reads a key's value back, decrypted, for anyone who passes
 * `api-key:read`. That is the point of `encrypted_key`: this token ships inside
 * an `iframe src` on the customer's public page, so refusing to show it to the
 * owner who minted it bought nothing and cost them the interaction.
 */

import { ApiResponse } from '@shared/utils'

import {
	createApiKey,
	getAllUserApiKeys
} from '../../lib/domain/auth/api-key-repository.server'
import { QuotaExceededError } from '../../lib/domain/billing/quota-exceeded-error'
import { canPerformDashboardOperation } from '../../lib/domain/dashboard/dashboard-operations'
import { resolveProjectMembership } from '../../lib/domain/dashboard/dashboard-permissions.server'
import { parseAllowedDomainPatterns } from '../../lib/domain/embed/embed-domain-policy'
import { toEmbedApiKeyOptions } from '../../lib/domain/embed/embed-key-options'
import { getProject } from '../../lib/domain/project/project-repository.server'
import { getAuthUser } from '../../lib/http/auth.server'
import { ensureValidCsrfFormData } from '../../lib/http/csrf.server'
import { ensurePost } from '../../lib/http/requests.server'
import { decryptEmbedToken } from '../../lib/security/embed-token-cipher.server'

import type { EmbedApiKeyOption } from '../../lib/domain/embed/embed-key-options'
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router'

/** Matches the 90-day default the full API key form offers. */
const DEFAULT_EXPIRY_DAYS = 90

/**
 * Re-attaches the auth headers to a response that could not carry them.
 *
 * `getAuthUser` returns a `Set-Cookie` whenever Supabase rotates the session,
 * and dropping it leaves the browser holding a token the server has already
 * replaced. Most `ApiResponse` statics take `options.headers`, but
 * `badRequest` and `quotaExceeded` do not, so the error paths need this.
 * `dashboard.mutations.ts` carries the same helper for the same reason.
 */
function withHeaders(response: Response, headers: Headers): Response {
	const merged = new Headers(response.headers)
	headers.forEach((value, key) => {
		merged.append(key, value)
	})

	return new Response(response.body, {
		status: response.status,
		headers: merged
	})
}

export interface EmbedApiKeysPayload {
	projectId: string
	projectName: string
	allowedDomains: string[]
	keys: EmbedApiKeyOption[]
	canCreateKey: boolean
}

export interface EmbedApiKeyCreatedPayload {
	key: EmbedApiKeyOption
	/**
	 * The freshly minted value.
	 *
	 * No longer the only time it is sent - the loader returns it too, from
	 * `encrypted_key` - and no longer a claim about storage. It stays on this
	 * payload because a create response should not need a second round trip to
	 * become usable.
	 */
	plaintext: string
}

async function resolveProjectAccess(request: Request, projectId?: string) {
	if (!projectId) {
		return { error: ApiResponse.badRequest('Missing project id') } as const
	}

	const authResult = await getAuthUser(request)
	if (authResult instanceof Response) {
		return { error: authResult } as const
	}

	const headers = new Headers(authResult.headers)
	const membership = await resolveProjectMembership(
		projectId,
		authResult.user.id
	)

	// A project the actor is not a member of is reported as missing rather than
	// forbidden, so this route cannot be used to probe which ids exist.
	if (!membership) {
		return {
			error: ApiResponse.notFound('Project not found', { headers })
		} as const
	}

	return { userId: authResult.user.id, headers, membership } as const
}

export async function loader({ request, params }: LoaderFunctionArgs) {
	const access = await resolveProjectAccess(request, params.projectId)
	if ('error' in access) {
		return access.error
	}

	const { userId, headers, membership } = access

	if (!canPerformDashboardOperation('api-key:read', membership)) {
		return ApiResponse.forbidden(
			'You do not have permission to view API keys',
			{ headers }
		)
	}

	const [project, allKeys] = await Promise.all([
		getProject(membership.projectId, userId),
		getAllUserApiKeys(userId)
	])

	if (!project) {
		return ApiResponse.notFound('Project not found', { headers })
	}

	const payload: EmbedApiKeysPayload = {
		projectId: project.id,
		projectName: project.name,
		allowedDomains: parseAllowedDomainPatterns(project.allowedEmbedDomains),
		/*
		  Decryption happens here, on the server, behind the `api-key:read` check
		  above. `toEmbedApiKeyOptions` is pure and client-safe, so it takes the
		  value already resolved rather than importing the cipher.
		*/
		keys: toEmbedApiKeyOptions(
			/*
			  Filtered before decrypting, not after. `getAllUserApiKeys` returns
			  every key in every organization this actor administers, and
			  `toEmbedApiKeyOptions` keeps only the ones scoped to this project -
			  so decrypting first spends AES on rows about to be discarded, and
			  puts their plaintext in memory for no reason.
			*/
			allKeys
				.filter((key) =>
					key.projects.some((scoped) => scoped.id === project.id)
				)
				.map((key) => ({
					...key,
					value: decryptEmbedToken(key.apiKey.encryptedKey)
				})),
			project.id,
			new Date()
		),
		canCreateKey: canPerformDashboardOperation('api-key:create', membership)
	}

	/*
	  `no-store`, explicitly. This payload now carries usable embed keys, and
	  `ApiResponse.success` sets no cache directive of its own - only
	  `ApiResponse.error` does. React Router's `handleDataRequest` hook, which
	  stamps one elsewhere, runs for `.data` paths and skips resource routes
	  entirely, so nothing else on this response says anything about caching.
	  Cloudflare's fail-closed catch-all covers the edge, but that leaves the
	  protection living in a Terraform rule instead of the response, and does
	  nothing about the browser's own disk cache.
	*/
	headers.set('Cache-Control', 'no-store')

	return ApiResponse.success(payload, 200, { headers })
}

export async function action({ request, params }: ActionFunctionArgs) {
	const methodCheck = ensurePost(request)
	if (methodCheck) {
		return methodCheck
	}

	const formData = await request.formData()

	const csrfCheck = await ensureValidCsrfFormData(request, formData)
	if (csrfCheck) {
		return csrfCheck
	}

	const access = await resolveProjectAccess(request, params.projectId)
	if ('error' in access) {
		return access.error
	}

	const { userId, headers, membership } = access

	if (formData.get('intent') !== 'create') {
		return withHeaders(ApiResponse.badRequest('Unsupported intent'), headers)
	}

	if (!canPerformDashboardOperation('api-key:create', membership)) {
		return ApiResponse.forbidden(
			'You do not have permission to create API keys',
			{ headers }
		)
	}

	const project = await getProject(membership.projectId, userId)
	if (!project) {
		return ApiResponse.notFound('Project not found', { headers })
	}

	const expiresAt = new Date()
	expiresAt.setDate(expiresAt.getDate() + DEFAULT_EXPIRY_DAYS)

	try {
		// `createApiKey` re-checks admin access and the per-org quota itself; the
		// check above is what turns a thrown error into a 403 the panel can render.
		const created = await createApiKey({
			userId,
			organizationId: membership.organizationId,
			name: `Embed key for ${project.name}`,
			description: 'Created from the scene embed panel.',
			projectIds: [project.id],
			expiresAt
		})

		/*
		  The plaintext straight from the mint, not a decrypt of what was just
		  written. Same value either way, and reading it back would only add a
		  round trip through the cipher for a row this request created.
		*/
		const [option] = toEmbedApiKeyOptions(
			[
				{
					apiKey: created.apiKey,
					projects: [{ id: project.id }],
					value: created.plaintext
				}
			],
			project.id,
			new Date()
		)

		const payload: EmbedApiKeyCreatedPayload = {
			key: option,
			plaintext: created.plaintext
		}

		return ApiResponse.created(payload, { headers })
	} catch (error) {
		if (error instanceof QuotaExceededError) {
			return withHeaders(
				ApiResponse.quotaExceeded(error.message, {
					limitKey: error.limitKey,
					currentValue: error.currentValue,
					limit: error.limit,
					plan: error.plan,
					upgradeTo: error.upgradeTo
				}),
				headers
			)
		}

		return withHeaders(
			ApiResponse.badRequest(
				error instanceof Error ? error.message : 'Could not create an API key'
			),
			headers
		)
	}
}
