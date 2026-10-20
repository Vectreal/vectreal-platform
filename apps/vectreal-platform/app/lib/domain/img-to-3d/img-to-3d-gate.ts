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
		}
	): Promise<{ getFlag(key: string): unknown }>
}

export interface ImgTo3dGateSubject {
	readonly userId: string
	readonly email: string | null
}

/**
 * Evaluated with the email passed in rather than read from a stored profile:
 * `PostHogIdentify` only identifies someone who accepted analytics, so a
 * condition on a stored email would silently miss anyone who declined. Passed
 * by the server, so a browser cannot claim it either.
 *
 * The email is the only property sent, and no group: the flag is released to
 * one person, and a condition that could match an organization would let its
 * whole membership spend GPU money. `model-intake-admin` is gated the same way.
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
			personProperties: subject.email ? { email: subject.email } : {}
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
 * PostHog or a GPU. Only in a development build: `import.meta.env.DEV` is
 * fixed when the bundle is built, so no environment a production build is
 * started with, `NODE_ENV` included, can show the panel to everyone or serve
 * a fixture instead of a model.
 */
export function isImgTo3dMockMode(
	env: Record<string, string | undefined> = process.env,
	isDevBuild: boolean = import.meta.env?.DEV === true
): boolean {
	return isDevBuild && env.IMG_TO_3D_MOCK_MODE === 'true'
}
