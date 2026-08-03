/**
 * Rules for where a folder may be moved.
 *
 * Pure and client-safe so the destination picker can grey out invalid targets
 * *with the reason*, and the repository can reject the same targets if a client
 * ignores that. One rule set, two consumers.
 *
 * `scene_folders.parent_folder_id` has no CHECK constraint behind any of this -
 * a cycle written by a bug is corruption that makes `getSceneFolderAncestry`
 * throw and takes the folder tree down with it. These checks are the only thing
 * preventing that.
 */

/**
 * The deepest a folder tree may nest.
 *
 * Reads throw past this, so anything nested deeper becomes unreadable and takes
 * the tree view with it. Create and move both enforce it, and the scene folder
 * repository imports this rather than keeping its own copy.
 */
export const MAX_FOLDER_DEPTH = 50

export type FolderMoveRejection =
	| 'same-parent'
	| 'self-parent'
	| 'descendant-parent'
	| 'cross-project'
	| 'too-deep'

export type FolderMoveValidation =
	| { ok: true }
	| { ok: false; reason: FolderMoveRejection; message: string }

export interface FolderMoveInput {
	folderId: string
	currentParentId: string | null
	/** Null means the project root. */
	targetParentId: string | null
	/** Every folder beneath `folderId`, at any depth. */
	descendantIds: ReadonlySet<string>
	/** Depth of every folder in the project, root-level folders being 0. */
	depthById: ReadonlyMap<string, number>
	/** Set when the target is known to live in another project. */
	targetIsCrossProject?: boolean
}

/**
 * Exported so folder *creation* can reject an over-deep nesting in the same
 * words the move path uses. Two rules that share a limit should share a message,
 * or users get told two different things about one constraint.
 */
export const FOLDER_RULE_MESSAGES: Record<FolderMoveRejection, string> = {
	'same-parent': 'This folder is already here',
	'self-parent': 'A folder cannot be moved into itself',
	'descendant-parent':
		'A folder cannot be moved into one of its own subfolders',
	'cross-project': 'Folders cannot move between projects',
	// Phrased for both callers: create hits this too, and "moving here" would be
	// wrong there.
	'too-deep': `Folders cannot nest more than ${MAX_FOLDER_DEPTH} levels deep`
}

function reject(reason: FolderMoveRejection): FolderMoveValidation {
	return { ok: false, reason, message: FOLDER_RULE_MESSAGES[reason] }
}

/**
 * The deepest level anything in this subtree would sit at after the move.
 *
 * Root-level is 0, so a folder moved to root with one level of children below
 * it ends at depth 1.
 */
function resultingMaxDepth(input: FolderMoveInput): number {
	const currentDepth = input.depthById.get(input.folderId) ?? 0

	let subtreeHeight = 0
	for (const descendantId of input.descendantIds) {
		const descendantDepth = input.depthById.get(descendantId)
		if (descendantDepth === undefined) {
			// Both sets describe the same project's folders, so a descendant the
			// depth map has never heard of means the two reads disagree - which is
			// the corrupt tree this guard exists to keep from getting worse. Report
			// it as over the limit rather than quietly measuring a shorter subtree.
			return MAX_FOLDER_DEPTH + 1
		}
		subtreeHeight = Math.max(subtreeHeight, descendantDepth - currentDepth)
	}

	const targetDepth =
		input.targetParentId === null
			? -1
			: (input.depthById.get(input.targetParentId) ?? 0)

	return targetDepth + 1 + subtreeHeight
}

export function validateFolderMove(
	input: FolderMoveInput
): FolderMoveValidation {
	if (input.targetIsCrossProject) {
		return reject('cross-project')
	}

	if (input.targetParentId === input.folderId) {
		return reject('self-parent')
	}

	if (
		input.targetParentId !== null &&
		input.descendantIds.has(input.targetParentId)
	) {
		return reject('descendant-parent')
	}

	// Checked after the structural rules so that dragging a folder onto itself
	// reports the more specific reason rather than "already here".
	if (input.targetParentId === input.currentParentId) {
		return reject('same-parent')
	}

	if (resultingMaxDepth(input) > MAX_FOLDER_DEPTH) {
		return reject('too-deep')
	}

	return { ok: true }
}

/**
 * Where a scene may be moved. Far simpler than folders: scenes have no subtree,
 * so only project boundaries and no-ops matter.
 */
export function validateSceneMove(input: {
	currentFolderId: string | null
	targetFolderId: string | null
	targetIsCrossProject?: boolean
}): FolderMoveValidation {
	if (input.targetIsCrossProject) {
		return reject('cross-project')
	}

	if (input.targetFolderId === input.currentFolderId) {
		return reject('same-parent')
	}

	return { ok: true }
}
