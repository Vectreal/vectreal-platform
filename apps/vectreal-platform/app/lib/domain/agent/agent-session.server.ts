import { readBearerToken } from './agent-bearer'
import { createSupabaseAdminClient } from '../../supabase.server'

/**
 * Ends the Auth session behind an agent request's bearer token, after
 * `authorizeAgentRequest` has accepted it. `local` ends this session only:
 * the user's browser sessions and other agents carry on.
 */
export async function endAgentSession(request: Request): Promise<void> {
	const bearer = readBearerToken(request)
	if (!bearer.ok) {
		throw new Error('endAgentSession runs after authorizeAgentRequest')
	}
	const { error } = await createSupabaseAdminClient().auth.admin.signOut(
		bearer.token,
		'local'
	)
	if (error) throw error
}
