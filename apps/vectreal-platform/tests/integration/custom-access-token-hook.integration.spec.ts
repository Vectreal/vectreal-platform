/**
 * The `custom_access_token_hook` function Supabase Auth runs on every token.
 *
 * It must set the agent audience on OAuth tokens and leave every other token
 * exactly as Auth built it, and it must keep working: an error here fails
 * token issuance for every login, first-party included. So the role Auth calls
 * it as must be able to execute it, and it must stay immutable, which is what
 * stops a write (and the failure modes that come with one) being added later.
 *
 * The cases call it as `postgres`, which cannot assume `supabase_auth_admin`
 * on Supabase's image. The result does not depend on the caller: the function
 * reads only its input and is not security definer.
 *
 * Opt-in:
 *   pnpm nx run vectreal-platform:supabase-start
 *   pnpm nx run vectreal-platform:test-integration
 */

import { sql } from 'drizzle-orm'
import { beforeAll, describe, expect, it } from 'vitest'

import { AGENT_TOKEN_AUDIENCE } from '../../app/lib/domain/agent/agent-token-audience'

type Db = ReturnType<typeof import('../../app/db/client').getDbClient>

// The shape Auth sends, trimmed to the claims this hook reads or must keep.
function tokenEvent(
	authenticationMethod: string,
	extraClaims: Record<string, unknown> = {}
) {
	return {
		user_id: '00000000-0000-4000-8000-000000000001',
		authentication_method: authenticationMethod,
		claims: {
			aud: 'authenticated',
			sub: '00000000-0000-4000-8000-000000000001',
			role: 'authenticated',
			session_id: '00000000-0000-4000-8000-000000000002',
			...extraClaims
		}
	}
}

describe('custom_access_token_hook', () => {
	let db: Db

	beforeAll(async () => {
		db = (await import('../../app/db/client')).getDbClient()
	})

	async function runHook(event: unknown): Promise<unknown> {
		const [row] = await db.execute<{ result: unknown }>(
			sql`select public.custom_access_token_hook(${JSON.stringify(event)}::jsonb) as result`
		)
		return row.result
	}

	it.each(['oauth_provider/authorization_code', 'token_refresh'])(
		'sets the agent audience on an OAuth token (%s)',
		async (method) => {
			const event = tokenEvent(method, {
				client_id: 'b7f1c2d4-0000-4000-8000-000000000003',
				scope: 'email'
			})

			expect(await runHook(event)).toEqual({
				...event,
				claims: { ...event.claims, aud: AGENT_TOKEN_AUDIENCE }
			})
		}
	)

	it.each([
		['a first-party sign-in', tokenEvent('password')],
		['a first-party refresh', tokenEvent('token_refresh')],
		[
			'a token whose client_id is null',
			tokenEvent('password', { client_id: null })
		]
	])('returns %s unchanged', async (_label, event) => {
		expect(await runHook(event)).toEqual(event)
	})

	it('can be executed by the role Auth calls it as', async () => {
		const [row] = await db.execute<{ schema: boolean; fn: boolean }>(sql`
			select
				has_schema_privilege('supabase_auth_admin', 'public', 'USAGE') as schema,
				has_function_privilege(
					'supabase_auth_admin',
					'public.custom_access_token_hook(jsonb)',
					'EXECUTE'
				) as fn
		`)
		expect(row).toEqual({ schema: true, fn: true })
	})

	it('stays immutable', async () => {
		const [row] = await db.execute<{ volatility: string }>(sql`
			select provolatile as volatility
			from pg_proc
			where oid = 'public.custom_access_token_hook(jsonb)'::regprocedure
		`)
		expect(row.volatility).toBe('i')
	})
})
