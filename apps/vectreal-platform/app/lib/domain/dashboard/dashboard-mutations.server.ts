/**
 * Executes a parsed dashboard mutation.
 *
 * The important property here is that nothing the client says about *state* is
 * trusted. The request carries ids and, for a delete, a confirmation string -
 * nothing else. Publish status, folder contents and scene counts are all
 * re-read from the database, and the confirmation tier is recomputed with the
 * same pure function the dialog used. A client that strips `sceneStatus` to
 * make a published scene look like a draft gets the stricter server verdict and
 * a 403.
 */

import {
	DASHBOARD_CONFIRMATION_TOKEN,
	requiresTypedConfirmation,
	type DashboardEntityRef
} from './dashboard-confirmation'
import { loadDashboardEntityRefs } from './dashboard-entity-loader.server'
import {
	summarize,
	type DashboardMutationRequest,
	type DashboardMutationResponse,
	type DashboardMutationResult,
	type DashboardMutationTarget
} from './dashboard-mutations'
import {
	deleteOperationFor,
	DashboardPermissionError,
	moveOperationFor,
	renameOperationFor
} from './dashboard-operations'
import { assertDashboardPermission } from './dashboard-permissions.server'
import { reportServerError } from '../../observability/report-server-error.server'
import { deleteAssets } from '../asset/asset-storage.server'
import {
	deleteProject,
	updateProject
} from '../project/project-repository.server'
import {
	createSceneFolder,
	deleteScene,
	deleteSceneFolder,
	moveScene,
	moveSceneFolder,
	renameScene,
	renameSceneFolder
} from '../scene/server/scene-folder-repository.server'

export class ConfirmationRequiredError extends Error {
	constructor() {
		super(
			`This deletion requires typing ${DASHBOARD_CONFIRMATION_TOKEN} to confirm.`
		)
		this.name = 'ConfirmationRequiredError'
	}
}

function notFound(target: DashboardMutationTarget): DashboardMutationResult {
	return {
		type: target.type,
		id: target.id,
		success: false,
		code: 'not-found',
		error: 'Not found or access denied'
	}
}

function toFailure(
	target: DashboardMutationTarget,
	error: unknown
): DashboardMutationResult {
	const isPermission = error instanceof DashboardPermissionError

	return {
		type: target.type,
		id: target.id,
		success: false,
		code: isPermission ? 'forbidden' : 'failed',
		error: error instanceof Error ? error.message : 'Action failed'
	}
}

async function runDelete(
	request: Extract<DashboardMutationRequest, { verb: 'delete' }>,
	userId: string
): Promise<DashboardMutationResponse> {
	const loaded = await loadDashboardEntityRefs(request.targets, userId)

	// Resolve access before asking for a confirmation. A target the actor cannot
	// delete is refused either way, and prompting someone to type `DELETE` for
	// something that can never succeed is a worse answer than saying no.
	const refusals = new Map<string, DashboardMutationResult>()
	const deletable: DashboardEntityRef[] = []

	for (const target of request.targets) {
		const entity = loaded.get(target.id)
		if (!entity) {
			refusals.set(target.id, notFound(target))
			continue
		}

		try {
			assertDashboardPermission(deleteOperationFor(target.type), entity)
			deletable.push(entity.ref)
		} catch (error) {
			refusals.set(target.id, toFailure(target, error))
		}
	}

	// The same function the dialog called, on state the server read itself, and
	// scoped to what will actually be deleted.
	if (requiresTypedConfirmation(deletable)) {
		if (request.confirmationText?.trim() !== DASHBOARD_CONFIRMATION_TOKEN) {
			// A whole-request condition, not a per-item one: nothing is deleted, so
			// this must not come back as a partial success.
			throw new ConfirmationRequiredError()
		}
	}

	const results: DashboardMutationResult[] = []
	const orphanedAssetIds: string[] = []

	for (const target of request.targets) {
		const refusal = refusals.get(target.id)
		if (refusal) {
			results.push(refusal)
			continue
		}

		try {
			switch (target.type) {
				case 'scene': {
					// Storage cleanup is deferred so a bulk delete makes one storage
					// round trip rather than one per scene.
					const { orphanedAssetIds: sceneAssetIds } = await deleteScene(
						target.id,
						userId,
						{ deferAssetCleanup: true }
					)
					orphanedAssetIds.push(...sceneAssetIds)
					break
				}
				case 'folder':
					await deleteSceneFolder(target.id, userId)
					break
				case 'project':
					await deleteProject(target.id, userId)
					break
			}

			results.push({ type: target.type, id: target.id, success: true })
		} catch (error) {
			results.push(toFailure(target, error))
		}
	}

	if (orphanedAssetIds.length > 0) {
		try {
			// Outside the loop and after every row is gone. `deleteAssets` only
			// guards itself per asset - reaching storage at all can still throw,
			// and by this point the rows are deleted, so letting that surface would
			// report a successful delete as a failure and invite a retry that finds
			// nothing. A stranded object is the cheaper outcome.
			await deleteAssets(orphanedAssetIds)
		} catch (error) {
			reportServerError(error)
		}
	}

	return { verb: 'delete', results, summary: summarize(results) }
}

async function runRename(
	request: Extract<DashboardMutationRequest, { verb: 'rename' }>,
	userId: string
): Promise<DashboardMutationResponse> {
	const { target, name } = request
	const loaded = await loadDashboardEntityRefs([target], userId)
	const entity = loaded.get(target.id)

	if (!entity) {
		const results = [notFound(target)]
		return { verb: 'rename', results, summary: summarize(results) }
	}

	const results: DashboardMutationResult[] = []
	try {
		assertDashboardPermission(renameOperationFor(target.type), entity)

		switch (target.type) {
			case 'scene':
				await renameScene(target.id, userId, name)
				break
			case 'folder':
				await renameSceneFolder(target.id, userId, name)
				break
			case 'project':
				await updateProject(target.id, { name }, userId)
				break
		}

		results.push({ type: target.type, id: target.id, success: true })
	} catch (error) {
		results.push(toFailure(target, error))
	}

	return { verb: 'rename', results, summary: summarize(results) }
}

async function runMove(
	request: Extract<DashboardMutationRequest, { verb: 'move' }>,
	userId: string
): Promise<DashboardMutationResponse> {
	const targetFolderId =
		request.moveTarget.kind === 'root' ? null : request.moveTarget.folderId

	const loaded = await loadDashboardEntityRefs(request.targets, userId)
	const results: DashboardMutationResult[] = []

	// Moving a folder into a folder that is itself being moved in the same
	// batch is not something the guards can see one item at a time, and the
	// resulting shape depends on execution order. Reject the whole batch.
	const movingFolderIds = new Set(
		request.targets.filter((t) => t.type === 'folder').map((t) => t.id)
	)
	if (targetFolderId !== null && movingFolderIds.has(targetFolderId)) {
		throw new Error('Cannot move a folder into another folder in the same move')
	}

	for (const target of request.targets) {
		const entity = loaded.get(target.id)
		if (!entity) {
			results.push(notFound(target))
			continue
		}

		try {
			if (target.type === 'project') {
				throw new Error('Projects cannot be moved')
			}

			assertDashboardPermission(moveOperationFor(target.type), entity)

			if (target.type === 'scene') {
				await moveScene(target.id, userId, targetFolderId)
			} else {
				await moveSceneFolder(target.id, userId, targetFolderId)
			}

			results.push({ type: target.type, id: target.id, success: true })
		} catch (error) {
			results.push(toFailure(target, error))
		}
	}

	return { verb: 'move', results, summary: summarize(results) }
}

async function runCreateFolder(
	request: Extract<DashboardMutationRequest, { verb: 'create-folder' }>,
	userId: string
): Promise<DashboardMutationResponse> {
	const folder = await createSceneFolder({
		projectId: request.projectId,
		userId,
		name: request.name,
		description: request.description,
		parentFolderId: request.parentFolderId
	})

	const results: DashboardMutationResult[] = [
		{ type: 'folder', id: folder.id, success: true }
	]

	return {
		verb: 'create-folder',
		results,
		summary: summarize(results),
		createdFolder: { id: folder.id, name: folder.name }
	}
}

export async function executeDashboardMutation(
	request: DashboardMutationRequest,
	userId: string
): Promise<DashboardMutationResponse> {
	switch (request.verb) {
		case 'create-folder':
			return runCreateFolder(request, userId)
		case 'rename':
			return runRename(request, userId)
		case 'move':
			return runMove(request, userId)
		case 'delete':
			return runDelete(request, userId)
	}
}
