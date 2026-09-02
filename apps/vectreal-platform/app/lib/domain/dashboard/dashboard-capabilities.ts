/**
 * Per-organization capabilities, shaped for a loader to ship and a component to
 * read.
 *
 * Replaces `computeProjectCreationCapabilities`, whose return type was inlined
 * four times with no exported name and whose name claimed "creation" while it
 * also returned edit, delete, quota and plan.
 *
 * The booleans here are *derived* by calling `canPerformDashboardOperation`
 * rather than hand-written, so they cannot drift from the permission table.
 * Anything not covered by them should call that function directly with the
 * `role` this map carries.
 */

import {
	canPerformDashboardOperation,
	type MembershipRole
} from './dashboard-operations'

import type { Plan } from '../../../constants/plan-config'

/** The minimum a caller must supply; deliberately not a Drizzle inferred type,
 * so this module stays free of any server-only import. */
export interface OrganizationMembershipLike {
	organization: { id: string }
	membership: { role: MembershipRole }
}

export interface OrganizationProjectQuota {
	projectsTotal: number
	projectsLimit: number | null
	plan?: Plan
	upgradeTo?: Plan | null
}

export interface DashboardOrganizationCapabilities {
	organizationId: string
	role: MembershipRole
	/** Role allows project creation *and* the quota has room. */
	canCreateProject: boolean
	canUpdateProject: boolean
	canDeleteProject: boolean
	projectsTotal: number
	projectsLimit: number | null
	quotaExceeded: boolean
	plan: Plan | null
	upgradeTo: Plan | null
}

export type DashboardCapabilityMap = Record<
	string,
	DashboardOrganizationCapabilities
>

/**
 * @param quotaByOrganization Optional. The dashboard layout ships a role-only
 * map and omits this - per-org quota means two extra round trips per
 * organization, which is not worth paying on every dashboard page. The projects
 * routes, which actually gate on quota, pass it.
 */
export function buildDashboardCapabilities(
	memberships: readonly OrganizationMembershipLike[],
	quotaByOrganization: Record<string, OrganizationProjectQuota> = {}
): DashboardCapabilityMap {
	const capabilities: DashboardCapabilityMap = {}

	for (const { organization, membership } of memberships) {
		const quota = quotaByOrganization[organization.id] ?? {
			projectsTotal: 0,
			projectsLimit: null
		}
		const quotaExceeded =
			quota.projectsLimit !== null && quota.projectsTotal >= quota.projectsLimit

		const actor = { role: membership.role }

		capabilities[organization.id] = {
			organizationId: organization.id,
			role: membership.role,
			canCreateProject:
				canPerformDashboardOperation('project:create', actor) && !quotaExceeded,
			canUpdateProject: canPerformDashboardOperation('project:update', actor),
			canDeleteProject: canPerformDashboardOperation('project:delete', actor),
			projectsTotal: quota.projectsTotal,
			projectsLimit: quota.projectsLimit,
			quotaExceeded,
			plan: quota.plan ?? null,
			upgradeTo: quota.upgradeTo ?? null
		}
	}

	return capabilities
}

