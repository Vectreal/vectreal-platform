/**
 * Who may open `/dashboard/intake`.
 *
 * There is no staff role in the app, so the internal page is gated the way
 * `billing-checkout` is: a PostHog flag evaluated on the server, where a
 * browser cannot claim the answer. Release it to Moritz's account by email.
 * Only an explicit `true` opens it; no client, a missing flag or a throw all
 * deny, and the route answers a denial with 404 so the page's existence is
 * not confirmed to anyone else.
 *
 * Development builds open it for any signed-in user, because local PostHog is
 * usually off and the page must be checkable on a laptop. `import.meta.env.DEV`
 * is false in every production build.
 *
 * Pure, and not `.server`, so the decision is testable without the route.
 */

export const MODEL_INTAKE_ADMIN_FLAG = 'model-intake-admin'

export interface IntakeFlagSource {
	isFeatureEnabled(
		key: string,
		distinctId: string,
		options?: { personProperties?: Record<string, string> }
	): Promise<boolean | undefined>
}

export async function canOpenIntakeAdmin(args: {
	flags: IntakeFlagSource | null | undefined
	userId: string
	email: string | undefined
	isDevBuild: boolean
}): Promise<boolean> {
	if (args.isDevBuild) return true
	if (!args.flags) return false

	try {
		const enabled = await args.flags.isFeatureEnabled(
			MODEL_INTAKE_ADMIN_FLAG,
			args.userId,
			{ personProperties: args.email ? { email: args.email } : {} }
		)
		return enabled === true
	} catch {
		return false
	}
}
