import { sql, type SQLWrapper } from 'drizzle-orm'
import { authUid } from 'drizzle-orm/supabase'

export const isUserSelf = (userIdColumn: SQLWrapper) =>
	sql`${userIdColumn} = ${authUid}`

export const isOrganizationMember = (organizationIdColumn: SQLWrapper) => sql`
		exists (
			select 1
			from organization_memberships om
			where om.organization_id = ${organizationIdColumn}
				and om.user_id = ${authUid}
		)
	`

export const isOrganizationAdmin = (organizationIdColumn: SQLWrapper) => sql`
		exists (
			select 1
			from organization_memberships om
			where om.organization_id = ${organizationIdColumn}
				and om.user_id = ${authUid}
				and om.role in ('owner', 'admin')
		)
	`

export const canAccessProject = (projectIdColumn: SQLWrapper) => sql`
		exists (
			select 1
			from projects p
			join organization_memberships om on om.organization_id = p.organization_id
			where p.id = ${projectIdColumn}
				and om.user_id = ${authUid}
		)
	`

export const canManageProject = (projectIdColumn: SQLWrapper) => sql`
		exists (
			select 1
			from projects p
			join organization_memberships om on om.organization_id = p.organization_id
			where p.id = ${projectIdColumn}
				and om.user_id = ${authUid}
				and om.role in ('owner', 'admin')
		)
	`

export const canAccessFolder = (folderIdColumn: SQLWrapper) => sql`
		exists (
			select 1
			from folders f
			join projects p on p.id = f.project_id
			join organization_memberships om on om.organization_id = p.organization_id
			where f.id = ${folderIdColumn}
				and om.user_id = ${authUid}
		)
	`

export const canManageFolder = (folderIdColumn: SQLWrapper) => sql`
		exists (
			select 1
			from folders f
			join projects p on p.id = f.project_id
			join organization_memberships om on om.organization_id = p.organization_id
			where f.id = ${folderIdColumn}
				and om.user_id = ${authUid}
				and om.role in ('owner', 'admin')
		)
	`

export const canAccessScene = (sceneIdColumn: SQLWrapper) => sql`
		exists (
			select 1
			from scenes s
			join projects p on p.id = s.project_id
			join organization_memberships om on om.organization_id = p.organization_id
			where s.id = ${sceneIdColumn}
				and om.user_id = ${authUid}
		)
	`

export const canManageScene = (sceneIdColumn: SQLWrapper) => sql`
		exists (
			select 1
			from scenes s
			join projects p on p.id = s.project_id
			join organization_memberships om on om.organization_id = p.organization_id
			where s.id = ${sceneIdColumn}
				and om.user_id = ${authUid}
				and om.role in ('owner', 'admin')
		)
	`

export const canAccessAsset = (assetIdColumn: SQLWrapper) => sql`
		exists (
			select 1
			from assets a
			join folders f on f.id = a.folder_id
			join projects p on p.id = f.project_id
			join organization_memberships om on om.organization_id = p.organization_id
			where a.id = ${assetIdColumn}
				and om.user_id = ${authUid}
		)
	`

export const canManageAsset = (assetIdColumn: SQLWrapper) => sql`
		exists (
			select 1
			from assets a
			join folders f on f.id = a.folder_id
			join projects p on p.id = f.project_id
			join organization_memberships om on om.organization_id = p.organization_id
			where a.id = ${assetIdColumn}
				and om.user_id = ${authUid}
				and om.role in ('owner', 'admin')
		)
	`

export const canAccessSceneFolder = (sceneFolderIdColumn: SQLWrapper) => sql`
		exists (
			select 1
			from scene_folders sf
			join projects p on p.id = sf.project_id
			join organization_memberships om on om.organization_id = p.organization_id
			where sf.id = ${sceneFolderIdColumn}
				and om.user_id = ${authUid}
		)
	`

export const canManageSceneFolder = (sceneFolderIdColumn: SQLWrapper) => sql`
		exists (
			select 1
			from scene_folders sf
			join projects p on p.id = sf.project_id
			join organization_memberships om on om.organization_id = p.organization_id
			where sf.id = ${sceneFolderIdColumn}
				and om.user_id = ${authUid}
				and om.role in ('owner', 'admin')
		)
	`

export const isGroupOwner = (groupIdColumn: SQLWrapper) => sql`
		exists (
			select 1
			from groups g
			where g.id = ${groupIdColumn}
				and g.owner_id = ${authUid}
		)
	`

export const isGroupMember = (groupIdColumn: SQLWrapper) => sql`
		exists (
			select 1
			from group_memberships gm
			where gm.group_id = ${groupIdColumn}
				and gm.user_id = ${authUid}
		)
	`

export const ownsApiKey = (apiKeyIdColumn: SQLWrapper) => sql`
		exists (
			select 1
			from api_keys ak
			where ak.id = ${apiKeyIdColumn}
				and ak.user_id = ${authUid}
		)
	`
