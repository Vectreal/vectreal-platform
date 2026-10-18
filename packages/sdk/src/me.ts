import { z } from 'zod'

/**
 * `GET /api/v1/me`: who an agent token acts as.
 *
 * Scopes, role, plan and billing state are open strings. The server owns those
 * lists and adds to them, and a CLI installed last month must still be able to
 * ask who it is the day a scope ships.
 */
export const meSchema = z.object({
	user: z.object({ id: z.string(), email: z.string().nullable() }),
	organization: z.object({
		id: z.string(),
		name: z.string(),
		role: z.string()
	}),
	client: z.object({ id: z.string() }),
	scopes: z.array(z.string()),
	plan: z.object({ plan: z.string(), billingState: z.string() })
})

export type Me = z.infer<typeof meSchema>
