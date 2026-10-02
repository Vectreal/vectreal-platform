/**
 * Whether someone may generate a model from an image.
 *
 * Every generation spends GPU money, so this is authorization, not a UI
 * toggle: the routes and the publisher loader all ask it, and the panel only
 * renders what the loader was told. Who is let in is managed in PostHog, on
 * the flag below, so enabling an account or an organization is a dashboard
 * change rather than a deploy.
 *
 * Only an explicit `true` opens it. No client, a flag the project does not
 * have, a failed fetch and a thrown error all deny - the lesson of
 * `checkout-kill-switch.ts`, where a switch skipped when the client was absent
 * had never actually been read.
 *
 * Pure and not `.server`, so it can be tested without a network or a database;
 * `img-to-3d-access.server.ts` supplies the real client.
 */

export const IMG_TO_3D_FLAG = 'img-to-3d-generation'

/**
 * The slice of posthog-node's client this needs, so a test can supply it.
 * `evaluateFlags` rather than `isFeatureEnabled`, which 5.48.1 deprecates.
 */
export interface ImgTo3dFlagSource {
	evaluateFlags(
		distinctId: string,
		options: {
			flagKeys: string[]
			personProperties: Record<string, string>
			groups: Record<string, string>
		}
	): Promise<{ getFlag(key: string): unknown }>
}

export interface ImgTo3dGateSubject {
	readonly userId: string
	readonly email: string | null
	readonly organizationId: string
}

/**
 * Evaluated with the properties a release condition would target, passed in
 * rather than read from stored profiles: `PostHogIdentify` only identifies
 * someone who accepted analytics, so a condition on a stored email would
 * silently miss anyone who declined. Passed by the server, so a browser cannot
 * claim them either.
 *
 * `organization_id` is a person property so organizations can be targeted on
 * PostHog's free tier; `groups` makes a group-level condition work too, should
 * Group Analytics ever be enabled.
 */
export async function isImgTo3dEnabled(
	flags: ImgTo3dFlagSource | null | undefined,
	subject: ImgTo3dGateSubject
): Promise<boolean> {
	if (!flags) {
		return false
	}

	try {
		const evaluation = await flags.evaluateFlags(subject.userId, {
			flagKeys: [IMG_TO_3D_FLAG],
			personProperties: {
				...(subject.email ? { email: subject.email } : {}),
				organization_id: subject.organizationId
			},
			groups: { organization: subject.organizationId }
		})

		// `true` and nothing else: a multivariate variant string is not a yes.
		return evaluation.getFlag(IMG_TO_3D_FLAG) === true
	} catch {
		return false
	}
}

/**
 * Mock mode fakes the runtime with a fixture, so it spends nothing and there
 * is nothing to authorize; it is how local development and tests run without
 * PostHog or a GPU. Never in production, so a stray env var there can neither
 * show the panel to everyone nor serve a fixture instead of a model.
 */
export function isImgTo3dMockMode(
	env: Record<string, string | undefined> = process.env
): boolean {
	return env.IMG_TO_3D_MOCK_MODE === 'true' && env.NODE_ENV !== 'production'
}
