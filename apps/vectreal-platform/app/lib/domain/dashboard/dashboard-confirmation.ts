/**
 * How much friction a destructive dashboard action deserves, and what to tell
 * the user about it.
 *
 * Pure and client-safe on purpose: the dialog calls this to decide what to
 * render, and the mutation endpoint calls the *same* function to decide what to
 * enforce. One implementation, two callers, no drift - a client that strips or
 * forges the state it sends still meets the stricter server verdict.
 */

import type { DashboardEntityType } from './dashboard-operations'

/**
 * The literal a user types to confirm a high-consequence delete.
 *
 * Deliberately not the entity's name: a single constant is what the account
 * deletion flow already established, and a name-typing variant was considered
 * and rejected.
 */
export const DASHBOARD_CONFIRMATION_TOKEN = 'DELETE'

/**
 * Deleting this many items at once is treated as high-consequence regardless of
 * what the items are. Five scenes is not a slip you undo by re-uploading one.
 */
export const TYPED_CONFIRMATION_BULK_THRESHOLD = 5

export type DashboardConfirmationTier = 'acknowledge' | 'typed'

export type SceneStatus = 'draft' | 'published' | 'archived'

/**
 * A dashboard entity as the UI knows it, carrying the state the confirmation
 * copy needs.
 *
 * The predecessor of this type dropped `status` on the floor, which is the
 * mechanical reason deleting a published scene looked identical to deleting a
 * draft. Every optional state field here exists so a call site cannot silently
 * omit the thing that determines the tier - see the fail-closed handling of
 * `childCount` in `requiresTypedConfirmation`.
 */
export interface DashboardEntityRef {
	type: DashboardEntityType
	id: string
	name: string
	/** Null for a project ref; the owning project otherwise. */
	projectId: string | null
	folderId?: string | null
	/** Scenes only. */
	sceneStatus?: SceneStatus
	/** Folders only: contained scenes plus subfolders. */
	childCount?: number
	/** Projects only. */
	sceneCount?: number
	/** Projects only. */
	publishedCount?: number
}

export interface DashboardConfirmationPlan {
	tier: DashboardConfirmationTier
	title: string
	description: string
	consequences: string[]
	confirmLabel: string
	/** The string the user must type, or null when the tier is `acknowledge`. */
	token: string | null
}

const IRREVERSIBLE = 'This cannot be undone'

/** Longest consequence list we render before it stops being read. */
const MAX_CONSEQUENCES = 5

function isPublishedScene(ref: DashboardEntityRef): boolean {
	return ref.type === 'scene' && ref.sceneStatus === 'published'
}

/**
 * A folder counts as non-empty unless it explicitly reports zero children.
 *
 * `undefined` means the caller did not supply a count, and the safe reading of
 * "I don't know" is "assume there is something in there" - the alternative
 * silently downgrades the tier whenever a loader forgets to include it.
 */
function isNonEmptyFolder(ref: DashboardEntityRef): boolean {
	return (
		ref.type === 'folder' &&
		(ref.childCount === undefined || ref.childCount > 0)
	)
}

export function requiresTypedConfirmation(
	refs: readonly DashboardEntityRef[]
): boolean {
	if (refs.length >= TYPED_CONFIRMATION_BULK_THRESHOLD) {
		return true
	}

	return refs.some(
		(ref) =>
			ref.type === 'project' || isPublishedScene(ref) || isNonEmptyFolder(ref)
	)
}

function pluralize(count: number, singular: string): string {
	return `${count} ${singular}${count === 1 ? '' : 's'}`
}

function capConsequences(consequences: string[]): string[] {
	if (consequences.length <= MAX_CONSEQUENCES) {
		return consequences
	}

	// Keep the irreversibility line last; it is the one that must survive.
	return [...consequences.slice(0, MAX_CONSEQUENCES - 1), IRREVERSIBLE]
}

function planSingleScene(ref: DashboardEntityRef): DashboardConfirmationPlan {
	if (ref.sceneStatus === 'published') {
		return {
			tier: 'typed',
			title: `Delete published scene "${ref.name}"?`,
			description:
				'This scene is live. Deleting it takes the published model offline immediately.',
			consequences: [
				'Every embed of this scene stops rendering, on every site using it',
				'The published GLB and its storage object are deleted',
				'Scene settings and optimization history are deleted',
				IRREVERSIBLE
			],
			confirmLabel: 'Delete published scene',
			token: DASHBOARD_CONFIRMATION_TOKEN
		}
	}

	return {
		tier: 'acknowledge',
		title: `Delete "${ref.name}"?`,
		description:
			'This scene and its saved settings will be removed. This cannot be undone.',
		consequences: ['Scene settings and optimization history are deleted'],
		confirmLabel: 'Delete scene',
		token: null
	}
}

function planSingleFolder(ref: DashboardEntityRef): DashboardConfirmationPlan {
	if (!isNonEmptyFolder(ref)) {
		return {
			tier: 'acknowledge',
			title: `Delete folder "${ref.name}"?`,
			description: 'This folder is empty. Deleting it changes nothing else.',
			consequences: [],
			confirmLabel: 'Delete folder',
			token: null
		}
	}

	const contents =
		ref.childCount === undefined
			? 'This folder may not be empty.'
			: `This folder holds ${pluralize(ref.childCount, 'item')}.`

	return {
		tier: 'typed',
		title: `Delete folder "${ref.name}"?`,
		description: contents,
		consequences: [
			'Scenes inside move to the project root, they are not deleted',
			'Subfolders inside are deleted along with this folder',
			IRREVERSIBLE
		],
		confirmLabel: 'Delete folder',
		token: DASHBOARD_CONFIRMATION_TOKEN
	}
}

function planSingleProject(ref: DashboardEntityRef): DashboardConfirmationPlan {
	const sceneCount = ref.sceneCount ?? 0
	const publishedCount = ref.publishedCount ?? 0

	const consequences: string[] = []
	if (sceneCount > 0) {
		consequences.push(
			publishedCount > 0
				? `${pluralize(sceneCount, 'scene')} are deleted, including ${publishedCount} published`
				: `${pluralize(sceneCount, 'scene')} are deleted`
		)
	}
	if (publishedCount > 0) {
		consequences.push('Every embed pointing at this project stops rendering')
	}
	consequences.push(
		'All folders, scene settings and optimization history are deleted',
		'API keys scoped to this project lose their target',
		IRREVERSIBLE
	)

	return {
		tier: 'typed',
		title: `Delete project "${ref.name}"?`,
		description: 'Deleting a project removes everything inside it.',
		consequences: capConsequences(consequences),
		confirmLabel: 'Delete project',
		token: DASHBOARD_CONFIRMATION_TOKEN
	}
}

function describeMixedCounts(refs: readonly DashboardEntityRef[]): string {
	const counts = {
		project: refs.filter((ref) => ref.type === 'project').length,
		folder: refs.filter((ref) => ref.type === 'folder').length,
		scene: refs.filter((ref) => ref.type === 'scene').length
	}

	const parts: string[] = []
	if (counts.project > 0) parts.push(pluralize(counts.project, 'project'))
	if (counts.folder > 0) parts.push(pluralize(counts.folder, 'folder'))
	if (counts.scene > 0) parts.push(pluralize(counts.scene, 'scene'))

	if (parts.length === 0) return ''
	if (parts.length === 1) return `${parts[0]}.`

	return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}.`
}

function planBulk(
	refs: readonly DashboardEntityRef[]
): DashboardConfirmationPlan {
	const publishedScenes = refs.filter(isPublishedScene).length
	const nonEmptyFolders = refs.filter(isNonEmptyFolder).length
	const projects = refs.filter((ref) => ref.type === 'project').length
	const tier = requiresTypedConfirmation(refs) ? 'typed' : 'acknowledge'

	const consequences: string[] = []
	if (publishedScenes > 0) {
		consequences.push(
			publishedScenes === 1
				? '1 of these scenes is published - its embeds stop rendering'
				: `${publishedScenes} of these scenes are published - their embeds stop rendering`
		)
	}
	if (nonEmptyFolders > 0) {
		consequences.push(
			`${pluralize(nonEmptyFolders, 'folder')} ${nonEmptyFolders === 1 ? 'is' : 'are'} not empty; their scenes move to the project root and their subfolders are deleted`
		)
	}
	if (projects > 0) {
		consequences.push(
			`Deleting ${pluralize(projects, 'project')} also deletes every folder and scene inside`
		)
	}
	consequences.push(IRREVERSIBLE)

	return {
		tier,
		title: `Delete ${refs.length} items?`,
		description: describeMixedCounts(refs),
		consequences: capConsequences(consequences),
		confirmLabel: `Delete ${refs.length} items`,
		token: tier === 'typed' ? DASHBOARD_CONFIRMATION_TOKEN : null
	}
}

/**
 * Builds the confirmation copy and tier for deleting `refs`.
 *
 * Safe on an empty list: returns a `typed` plan that says nothing is selected,
 * so a caller that opens the dialog with a stale selection gets a dead end
 * rather than a confirm button wired to a no-op delete.
 */
export function planDeleteConfirmation(
	refs: readonly DashboardEntityRef[]
): DashboardConfirmationPlan {
	if (refs.length === 0) {
		return {
			tier: 'typed',
			title: 'Nothing selected',
			description: 'Select at least one item to delete.',
			consequences: [],
			confirmLabel: 'Delete',
			token: DASHBOARD_CONFIRMATION_TOKEN
		}
	}

	if (refs.length === 1) {
		const [ref] = refs
		switch (ref.type) {
			case 'project':
				return planSingleProject(ref)
			case 'folder':
				return planSingleFolder(ref)
			case 'scene':
				return planSingleScene(ref)
		}
	}

	return planBulk(refs)
}

/*
 * Mappers from table rows to entity refs.
 *
 * These exist so call sites stop hand-building object literals - every one of
 * them used to, and every one of them dropped `status` doing it.
 */

interface SceneRowLike {
	id: string
	name: string
	projectId: string
	folderId?: string | null
	status?: string
}

interface FolderRowLike {
	id: string
	name: string
	projectId: string
	folderId?: string | null
	childCount?: number
}

interface ProjectRowLike {
	id: string
	name: string
	sceneCount?: number
	counts?: { published?: number }
}

function normalizeSceneStatus(
	status: string | undefined
): SceneStatus | undefined {
	return status === 'draft' || status === 'published' || status === 'archived'
		? status
		: undefined
}

export function toSceneRef(row: SceneRowLike): DashboardEntityRef {
	return {
		type: 'scene',
		id: row.id,
		name: row.name,
		projectId: row.projectId,
		folderId: row.folderId ?? null,
		sceneStatus: normalizeSceneStatus(row.status)
	}
}

export function toFolderRef(row: FolderRowLike): DashboardEntityRef {
	return {
		type: 'folder',
		id: row.id,
		name: row.name,
		projectId: row.projectId,
		folderId: row.folderId ?? null,
		childCount: row.childCount
	}
}

export function toProjectRef(row: ProjectRowLike): DashboardEntityRef {
	return {
		type: 'project',
		id: row.id,
		name: row.name,
		projectId: null,
		sceneCount: row.sceneCount,
		publishedCount: row.counts?.published
	}
}

/** Dispatches on `row.type` for the mixed scene/folder content tables. */
export function toContentRef(
	row: (SceneRowLike & FolderRowLike) & { type: 'scene' | 'folder' }
): DashboardEntityRef {
	return row.type === 'folder' ? toFolderRef(row) : toSceneRef(row)
}
