/**
 * The enforcement layer, with the database and storage mocked out.
 *
 * The pure specs prove the permission table and the confirmation ladder answer
 * correctly. This one proves the executor *asks* them, in the right order, and
 * that a refusal actually stops the repository from being called - which is the
 * property the whole feature rests on, since RLS is inert for app traffic and
 * this is the only authorization that runs.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LoadedEntity } from '../app/lib/domain/dashboard/dashboard-entity-loader.server'
import type { DashboardMutationRequest } from '../app/lib/domain/dashboard/dashboard-mutations'

vi.mock('../app/db/client', () => ({
	getDbClient: () => ({})
}))

vi.mock('../app/lib/domain/dashboard/dashboard-entity-loader.server', () => ({
	loadDashboardEntityRefs: vi.fn()
}))

vi.mock(
	'../app/lib/domain/scene/server/scene-folder-repository.server',
	() => ({
		createSceneFolder: vi.fn(),
		deleteScene: vi.fn(async () => ({ orphanedAssetIds: [] })),
		deleteSceneFolder: vi.fn(),
		moveScene: vi.fn(),
		moveSceneFolder: vi.fn(),
		renameScene: vi.fn(),
		renameSceneFolder: vi.fn()
	})
)

vi.mock('../app/lib/domain/project/project-repository.server', () => ({
	deleteProject: vi.fn(),
	updateProject: vi.fn()
}))

vi.mock('../app/lib/domain/asset/asset-storage.server', () => ({
	deleteAssets: vi.fn()
}))

const { loadDashboardEntityRefs } =
	await import('../app/lib/domain/dashboard/dashboard-entity-loader.server')
const repository =
	await import('../app/lib/domain/scene/server/scene-folder-repository.server')
const projectRepository =
	await import('../app/lib/domain/project/project-repository.server')
const { deleteAssets } =
	await import('../app/lib/domain/asset/asset-storage.server')
const { ConfirmationRequiredError, executeDashboardMutation } =
	await import('../app/lib/domain/dashboard/dashboard-mutations.server')

const USER = 'user-1'

const loadMock = vi.mocked(loadDashboardEntityRefs)

function draftScene(id: string, overrides: Partial<LoadedEntity> = {}) {
	return {
		ref: {
			type: 'scene' as const,
			id,
			name: `Scene ${id}`,
			projectId: 'project-1',
			folderId: null,
			sceneStatus: 'draft' as const
		},
		role: 'owner' as const,
		isResourceOwner: false,
		...overrides
	}
}

function publishedScene(id: string, overrides: Partial<LoadedEntity> = {}) {
	const entity = draftScene(id, overrides)
	return {
		...entity,
		ref: { ...entity.ref, sceneStatus: 'published' as const }
	}
}

function folder(id: string, childCount: number, role: 'owner' | 'member') {
	return {
		ref: {
			type: 'folder' as const,
			id,
			name: `Folder ${id}`,
			projectId: 'project-1',
			folderId: null,
			childCount
		},
		role,
		isResourceOwner: false
	}
}

function loads(...entities: LoadedEntity[]) {
	loadMock.mockResolvedValue(
		new Map(entities.map((entity) => [entity.ref.id, entity]))
	)
}

function deleteRequest(
	ids: Array<{ type: 'scene' | 'folder' | 'project'; id: string }>,
	confirmationText: string | null = null
): DashboardMutationRequest {
	return { verb: 'delete', targets: ids, confirmationText }
}

beforeEach(() => {
	vi.clearAllMocks()
	vi.mocked(repository.deleteScene).mockResolvedValue({ orphanedAssetIds: [] })
})

describe('delete execution', () => {
	it('deletes a draft scene without any confirmation text', async () => {
		loads(draftScene('scene-1'))

		const response = await executeDashboardMutation(
			deleteRequest([{ type: 'scene', id: 'scene-1' }]),
			USER
		)

		expect(response.summary).toEqual({ total: 1, succeeded: 1, failed: 0 })
		expect(repository.deleteScene).toHaveBeenCalledWith('scene-1', USER, {
			deferAssetCleanup: true
		})
	})

	it('refuses a published scene when the confirmation is missing, and deletes nothing', async () => {
		loads(publishedScene('scene-1'))

		await expect(
			executeDashboardMutation(
				deleteRequest([{ type: 'scene', id: 'scene-1' }]),
				USER
			)
		).rejects.toBeInstanceOf(ConfirmationRequiredError)

		expect(repository.deleteScene).not.toHaveBeenCalled()
	})

	it('refuses a forged draft status, because the tier comes from the server read', async () => {
		// The client claimed draft; the loader says published. The loader wins.
		loads(publishedScene('scene-1'))

		await expect(
			executeDashboardMutation(
				deleteRequest([{ type: 'scene', id: 'scene-1' }]),
				USER
			)
		).rejects.toBeInstanceOf(ConfirmationRequiredError)
	})

	it('rejects a lowercase confirmation', async () => {
		loads(publishedScene('scene-1'))

		await expect(
			executeDashboardMutation(
				deleteRequest([{ type: 'scene', id: 'scene-1' }], 'delete'),
				USER
			)
		).rejects.toBeInstanceOf(ConfirmationRequiredError)

		expect(repository.deleteScene).not.toHaveBeenCalled()
	})

	it('accepts DELETE with surrounding whitespace', async () => {
		loads(publishedScene('scene-1'))

		const response = await executeDashboardMutation(
			deleteRequest([{ type: 'scene', id: 'scene-1' }], '  DELETE  '),
			USER
		)

		expect(response.summary.succeeded).toBe(1)
	})

	it('denies a member deleting a scene without asking them to confirm first', async () => {
		loads(publishedScene('scene-1', { role: 'member' }))

		// No ConfirmationRequiredError: the actor cannot delete this at all, so
		// prompting for a token that could never work is the wrong answer.
		const response = await executeDashboardMutation(
			deleteRequest([{ type: 'scene', id: 'scene-1' }]),
			USER
		)

		expect(response.results[0]).toMatchObject({
			id: 'scene-1',
			success: false,
			code: 'forbidden'
		})
		expect(repository.deleteScene).not.toHaveBeenCalled()
	})

	it('computes the tier from deletable items only', async () => {
		// The published one is refused on permission, so what remains is a single
		// draft - which does not need a typed confirmation.
		loads(
			publishedScene('scene-1', { role: 'member' }),
			draftScene('scene-2', { role: 'member' })
		)

		const response = await executeDashboardMutation(
			deleteRequest([
				{ type: 'scene', id: 'scene-1' },
				{ type: 'scene', id: 'scene-2' }
			]),
			USER
		)

		expect(response.summary).toEqual({ total: 2, succeeded: 0, failed: 2 })
		expect(repository.deleteScene).not.toHaveBeenCalled()
	})

	it('reports an unknown target as not-found without touching the others', async () => {
		loads(draftScene('scene-1'))

		const response = await executeDashboardMutation(
			deleteRequest([
				{ type: 'scene', id: 'scene-1' },
				{ type: 'scene', id: 'scene-missing' }
			]),
			USER
		)

		expect(response.summary).toEqual({ total: 2, succeeded: 1, failed: 1 })
		expect(
			response.results.find((result) => result.id === 'scene-missing')
		).toMatchObject({ code: 'not-found' })
		expect(repository.deleteScene).toHaveBeenCalledTimes(1)
	})

	it('escalates to typed confirmation for a non-empty folder', async () => {
		loads(folder('folder-1', 3, 'owner'))

		await expect(
			executeDashboardMutation(
				deleteRequest([{ type: 'folder', id: 'folder-1' }]),
				USER
			)
		).rejects.toBeInstanceOf(ConfirmationRequiredError)
	})

	it('lets an empty folder go with a plain acknowledgement', async () => {
		loads(folder('folder-1', 0, 'owner'))

		const response = await executeDashboardMutation(
			deleteRequest([{ type: 'folder', id: 'folder-1' }]),
			USER
		)

		expect(response.summary.succeeded).toBe(1)
		expect(repository.deleteSceneFolder).toHaveBeenCalledWith('folder-1', USER)
	})

	it('keeps going after one target throws', async () => {
		loads(draftScene('scene-1'), draftScene('scene-2'))
		vi.mocked(repository.deleteScene)
			.mockRejectedValueOnce(new Error('constraint violation'))
			.mockResolvedValueOnce({ orphanedAssetIds: [] })

		const response = await executeDashboardMutation(
			deleteRequest([
				{ type: 'scene', id: 'scene-1' },
				{ type: 'scene', id: 'scene-2' }
			]),
			USER
		)

		expect(response.summary).toEqual({ total: 2, succeeded: 1, failed: 1 })
		expect(response.results[0]).toMatchObject({
			code: 'failed',
			error: 'constraint violation'
		})
	})

	it('batches orphaned assets into one storage call', async () => {
		loads(draftScene('scene-1'), draftScene('scene-2'))
		vi.mocked(repository.deleteScene)
			.mockResolvedValueOnce({ orphanedAssetIds: ['asset-a'] })
			.mockResolvedValueOnce({ orphanedAssetIds: ['asset-b'] })

		await executeDashboardMutation(
			deleteRequest([
				{ type: 'scene', id: 'scene-1' },
				{ type: 'scene', id: 'scene-2' }
			]),
			USER
		)

		expect(deleteAssets).toHaveBeenCalledTimes(1)
		expect(deleteAssets).toHaveBeenCalledWith(['asset-a', 'asset-b'])
	})

	it('skips the storage call when nothing was published', async () => {
		loads(draftScene('scene-1'))

		await executeDashboardMutation(
			deleteRequest([{ type: 'scene', id: 'scene-1' }]),
			USER
		)

		expect(deleteAssets).not.toHaveBeenCalled()
	})

	it('keeps project delete to owners', async () => {
		loads({
			ref: {
				type: 'project',
				id: 'project-1',
				name: 'Project',
				projectId: null,
				sceneCount: 0,
				publishedCount: 0
			},
			role: 'admin',
			isResourceOwner: false
		})

		const response = await executeDashboardMutation(
			deleteRequest([{ type: 'project', id: 'project-1' }], 'DELETE'),
			USER
		)

		expect(response.results[0]).toMatchObject({ code: 'forbidden' })
		expect(projectRepository.deleteProject).not.toHaveBeenCalled()
	})
})

describe('move execution', () => {
	it('moves a scene into a folder', async () => {
		loads(draftScene('scene-1'))

		const response = await executeDashboardMutation(
			{
				verb: 'move',
				targets: [{ type: 'scene', id: 'scene-1' }],
				moveTarget: { kind: 'folder', folderId: 'folder-9' }
			},
			USER
		)

		expect(response.summary.succeeded).toBe(1)
		expect(repository.moveScene).toHaveBeenCalledWith(
			'scene-1',
			USER,
			'folder-9'
		)
	})

	it('passes null for a move to the project root', async () => {
		loads(draftScene('scene-1'))

		await executeDashboardMutation(
			{
				verb: 'move',
				targets: [{ type: 'scene', id: 'scene-1' }],
				moveTarget: { kind: 'root' }
			},
			USER
		)

		expect(repository.moveScene).toHaveBeenCalledWith('scene-1', USER, null)
	})

	it('rejects the whole batch when the destination is itself being moved', async () => {
		loads(folder('folder-1', 0, 'owner'), folder('folder-2', 0, 'owner'))

		await expect(
			executeDashboardMutation(
				{
					verb: 'move',
					targets: [
						{ type: 'folder', id: 'folder-1' },
						{ type: 'folder', id: 'folder-2' }
					],
					moveTarget: { kind: 'folder', folderId: 'folder-2' }
				},
				USER
			)
		).rejects.toThrow(/same move/)

		expect(repository.moveSceneFolder).not.toHaveBeenCalled()
	})

	it('lets a member move a scene', async () => {
		// Move is not destructive, so members organize their own work.
		loads(draftScene('scene-1', { role: 'member' }))

		const response = await executeDashboardMutation(
			{
				verb: 'move',
				targets: [{ type: 'scene', id: 'scene-1' }],
				moveTarget: { kind: 'root' }
			},
			USER
		)

		expect(response.summary.succeeded).toBe(1)
	})
})

describe('rename execution', () => {
	it('renames a scene a member owns', async () => {
		loads(draftScene('scene-1', { role: 'member' }))

		const response = await executeDashboardMutation(
			{ verb: 'rename', target: { type: 'scene', id: 'scene-1' }, name: 'New' },
			USER
		)

		expect(response.summary.succeeded).toBe(1)
		expect(repository.renameScene).toHaveBeenCalledWith('scene-1', USER, 'New')
	})

	it('denies a member renaming a folder they did not create', async () => {
		loads(folder('folder-1', 0, 'member'))

		const response = await executeDashboardMutation(
			{
				verb: 'rename',
				target: { type: 'folder', id: 'folder-1' },
				name: 'New'
			},
			USER
		)

		expect(response.results[0]).toMatchObject({ code: 'forbidden' })
		expect(repository.renameSceneFolder).not.toHaveBeenCalled()
	})

	it('allows a member to rename a folder they created', async () => {
		loads({ ...folder('folder-1', 0, 'member'), isResourceOwner: true })

		const response = await executeDashboardMutation(
			{
				verb: 'rename',
				target: { type: 'folder', id: 'folder-1' },
				name: 'New'
			},
			USER
		)

		expect(response.summary.succeeded).toBe(1)
	})
})
