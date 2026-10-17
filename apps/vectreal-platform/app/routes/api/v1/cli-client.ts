/**
 * GET /api/v1/cli/client
 *
 * How the CLI signs in against this origin: its OAuth client id, the loopback
 * redirect URIs registered for it (it listens on the first free one), and the
 * authorization server to send the browser to. One CLI build then works
 * against production, staging or a local stack by origin alone.
 *
 * Public and cacheable. None of it is secret: a public PKCE client's id and
 * redirect URIs appear in every authorize URL it opens.
 */

import { ApiResponse } from '@shared/utils'

import { findCliClient } from '../../../lib/domain/agent/agent-cli-client.server'

export async function loader() {
	const client = await findCliClient()
	if (!client) {
		return ApiResponse.notFound('No CLI client is registered on this server')
	}

	return ApiResponse.success(
		{
			client_id: client.clientId,
			redirect_uris: client.redirectUris,
			authorization_server: `${process.env.SUPABASE_URL}/auth/v1`
		},
		200,
		{ headers: { 'Cache-Control': 'public, max-age=300' } }
	)
}
