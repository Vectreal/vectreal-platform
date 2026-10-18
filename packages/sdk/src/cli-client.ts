import { z } from 'zod'

/**
 * `GET /api/v1/cli/client`: how the CLI signs in against an origin. Public, so
 * it is the one call made before there is a token.
 */
export const cliClientSchema = z.object({
	client_id: z.string(),
	redirect_uris: z.array(z.string()),
	authorization_server: z.string()
})

export type CliClient = z.infer<typeof cliClientSchema>
