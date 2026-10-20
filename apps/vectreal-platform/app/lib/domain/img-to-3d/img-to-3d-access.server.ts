import { isImgTo3dEnabled, isImgTo3dMockMode } from './img-to-3d-gate'
import { getPosthogClient } from '../../posthog/posthog-client.server'
import { getOrCreateDefaultOrganization } from '../user/user-repository.server'

import type { User } from '@supabase/supabase-js'

/**
 * The organization a generation is charged to, or `null` when the caller may
 * not generate at all.
 *
 * The one place the rule is applied. When generation becomes a product, this
 * is the function a plan entitlement replaces (`hasEntitlement(orgId,
 * 'img_to_3d_generation')`); every caller already goes through it.
 *
 * The organization is the caller's default one, the same the publisher saves a
 * new scene into.
 */
export async function resolveImgTo3dAccess(
	user: User
): Promise<{ organizationId: string } | null> {
	if (!(await isImgTo3dEnabledFor(user))) return null
	const organization = await getOrCreateDefaultOrganization(user.id)
	return { organizationId: organization.id }
}

/** Whether the panel is drawn; the routes ask `resolveImgTo3dAccess`. */
export async function isImgTo3dEnabledFor(user: User): Promise<boolean> {
	if (isImgTo3dMockMode()) {
		return true
	}

	return isImgTo3dEnabled(getPosthogClient(), {
		userId: user.id,
		email: user.email ?? null
	})
}
