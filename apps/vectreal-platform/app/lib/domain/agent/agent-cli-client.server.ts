import { createSupabaseAdminClient } from '../../supabase.server'

/**
 * The name the CLI's OAuth client is registered under. The client itself is
 * created and kept in shape by `terraform/scripts/setup-fly-secrets.sh`
 * (`CLI_OAUTH_CLIENT_NAME` there); the app only finds it by this name, so the
 * id Supabase generates for each project is never copied anywhere.
 */
export const CLI_OAUTH_CLIENT_NAME = 'Vectreal CLI'

export interface CliClient {
	clientId: string
	redirectUris: string[]
}

/** The CLI's OAuth client on this project, or null when none is registered. */
export async function findCliClient(): Promise<CliClient | null> {
	const { data, error } =
		await createSupabaseAdminClient().auth.admin.oauth.listClients({
			perPage: 100
		})
	if (error) {
		throw error
	}

	const client = data.clients.find(
		({ client_name }) => client_name === CLI_OAUTH_CLIENT_NAME
	)
	return client
		? { clientId: client.client_id, redirectUris: client.redirect_uris }
		: null
}
