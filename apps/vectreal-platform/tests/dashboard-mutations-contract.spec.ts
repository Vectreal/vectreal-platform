import {
	parseDashboardMutationRequest,
	serializeDashboardMutationRequest,
	summarize,
	type DashboardMutationRequest
} from '../app/lib/domain/dashboard/dashboard-mutations'

const SCENE_ID = '22222222-2222-4222-8222-222222222222'
const FOLDER_ID = '33333333-3333-4333-8333-333333333333'
const PROJECT_ID = '44444444-4444-4444-8444-444444444444'

/** Mirrors what `parseActionRequest` hands the route: flat string fields. */
function wire(request: DashboardMutationRequest): Record<string, unknown> {
	return serializeDashboardMutationRequest(request)
}

function expectOk(source: Record<string, unknown>): DashboardMutationRequest {
	const result = parseDashboardMutationRequest(source)
	if (!result.ok) {
		throw new Error(`expected parse to succeed, got: ${result.error}`)
	}
	return result.value
}

function expectError(source: Record<string, unknown>): string {
	const result = parseDashboardMutationRequest(source)
	if (result.ok) {
		throw new Error('expected parse to fail')
	}
	return result.error
}

describe('dashboard mutation contract', () => {
	describe('verb dispatch', () => {
		it('rejects a missing verb', () => {
			expect(expectError({})).toContain('unknown verb')
		})

		it('rejects an unknown verb', () => {
			expect(expectError({ verb: 'obliterate' })).toContain('obliterate')
		})
	})

	describe('targets', () => {
		it('rejects absent targets', () => {
			expect(expectError({ verb: 'delete' })).toContain('targets is required')
		})

		it('rejects malformed JSON', () => {
			expect(expectError({ verb: 'delete', targets: '[{' })).toContain(
				'valid JSON'
			)
		})

		it('rejects an empty array', () => {
			expect(expectError({ verb: 'delete', targets: '[]' })).toContain(
				'non-empty'
			)
		})

		it('rejects an unknown entity type', () => {
			expect(
				expectError({
					verb: 'delete',
					targets: JSON.stringify([{ type: 'organization', id: SCENE_ID }])
				})
			).toContain('unknown target type')
		})

		it('rejects a non-UUID id, which would reach the driver as a cast error', () => {
			expect(
				expectError({
					verb: 'delete',
					targets: JSON.stringify([{ type: 'scene', id: 'not-a-uuid' }])
				})
			).toContain('UUID')
		})

		it('caps the batch size', () => {
			const targets = Array.from({ length: 201 }, () => ({
				type: 'scene',
				id: SCENE_ID
			}))

			expect(
				expectError({ verb: 'delete', targets: JSON.stringify(targets) })
			).toContain('may not exceed')
		})
	})

	describe('delete', () => {
		it('accepts a well-formed request', () => {
			const parsed = expectOk(
				wire({
					verb: 'delete',
					targets: [{ type: 'scene', id: SCENE_ID }],
					confirmationText: 'DELETE'
				})
			)

			expect(parsed).toEqual({
				verb: 'delete',
				targets: [{ type: 'scene', id: SCENE_ID }],
				confirmationText: 'DELETE'
			})
		})

		it('leaves confirmation text untrimmed so the server owns the comparison', () => {
			const parsed = expectOk({
				verb: 'delete',
				targets: JSON.stringify([{ type: 'scene', id: SCENE_ID }]),
				confirmationText: '  DELETE  '
			})

			expect(parsed.verb === 'delete' && parsed.confirmationText).toBe(
				'  DELETE  '
			)
		})

		it('represents an absent confirmation as null, not empty string', () => {
			const parsed = expectOk({
				verb: 'delete',
				targets: JSON.stringify([{ type: 'scene', id: SCENE_ID }])
			})

			expect(parsed.verb === 'delete' && parsed.confirmationText).toBeNull()
		})
	})

	describe('rename', () => {
		it('accepts exactly one target', () => {
			const parsed = expectOk(
				wire({
					verb: 'rename',
					target: { type: 'folder', id: FOLDER_ID },
					name: 'Renamed'
				})
			)

			expect(parsed).toEqual({
				verb: 'rename',
				target: { type: 'folder', id: FOLDER_ID },
				name: 'Renamed'
			})
		})

		it('refuses to apply one name to a whole selection', () => {
			expect(
				expectError({
					verb: 'rename',
					targets: JSON.stringify([
						{ type: 'scene', id: SCENE_ID },
						{ type: 'folder', id: FOLDER_ID }
					]),
					name: 'Same Name'
				})
			).toContain('exactly one target')
		})

		it('requires a name', () => {
			expect(
				expectError({
					verb: 'rename',
					targets: JSON.stringify([{ type: 'scene', id: SCENE_ID }]),
					name: '   '
				})
			).toContain('name is required')
		})
	})

	describe('move', () => {
		it('accepts a folder destination', () => {
			const parsed = expectOk(
				wire({
					verb: 'move',
					targets: [{ type: 'scene', id: SCENE_ID }],
					moveTarget: { kind: 'folder', folderId: FOLDER_ID }
				})
			)

			expect(parsed).toEqual({
				verb: 'move',
				targets: [{ type: 'scene', id: SCENE_ID }],
				moveTarget: { kind: 'folder', folderId: FOLDER_ID }
			})
		})

		it('distinguishes "move to root" from "field absent"', () => {
			const parsed = expectOk(
				wire({
					verb: 'move',
					targets: [{ type: 'scene', id: SCENE_ID }],
					moveTarget: { kind: 'root' }
				})
			)

			expect(parsed.verb === 'move' && parsed.moveTarget).toEqual({
				kind: 'root'
			})

			expect(
				expectError({
					verb: 'move',
					targets: JSON.stringify([{ type: 'scene', id: SCENE_ID }])
				})
			).toContain('moveTarget is required')
		})

		it('rejects moving a project, which has no parent', () => {
			expect(
				expectError({
					verb: 'move',
					targets: JSON.stringify([{ type: 'project', id: PROJECT_ID }]),
					moveTarget: JSON.stringify({ kind: 'root' })
				})
			).toContain('projects cannot be moved')
		})

		it('rejects an unknown destination kind', () => {
			expect(
				expectError({
					verb: 'move',
					targets: JSON.stringify([{ type: 'scene', id: SCENE_ID }]),
					moveTarget: JSON.stringify({ kind: 'trash' })
				})
			).toContain('unknown moveTarget kind')
		})
	})

	describe('create-folder', () => {
		it('accepts a root-level folder', () => {
			const parsed = expectOk(
				wire({
					verb: 'create-folder',
					projectId: PROJECT_ID,
					name: 'New Folder',
					description: null,
					parentFolderId: null
				})
			)

			expect(parsed).toEqual({
				verb: 'create-folder',
				projectId: PROJECT_ID,
				name: 'New Folder',
				description: null,
				parentFolderId: null
			})
		})

		it('requires a project and a name', () => {
			expect(expectError({ verb: 'create-folder', name: 'x' })).toContain(
				'projectId'
			)
			expect(
				expectError({ verb: 'create-folder', projectId: PROJECT_ID })
			).toContain('name is required')
		})
	})

	describe('round trip', () => {
		const cases: DashboardMutationRequest[] = [
			{
				verb: 'create-folder',
				projectId: PROJECT_ID,
				name: 'Folder',
				description: 'A description',
				parentFolderId: FOLDER_ID
			},
			{ verb: 'rename', target: { type: 'scene', id: SCENE_ID }, name: 'New' },
			{
				verb: 'move',
				targets: [
					{ type: 'scene', id: SCENE_ID },
					{ type: 'folder', id: FOLDER_ID }
				],
				moveTarget: { kind: 'root' }
			},
			{
				verb: 'delete',
				targets: [{ type: 'project', id: PROJECT_ID }],
				confirmationText: 'DELETE'
			}
		]

		it('survives serialize then parse unchanged', () => {
			for (const request of cases) {
				expect(expectOk(wire(request)), request.verb).toEqual(request)
			}
		})
	})

	describe('summarize', () => {
		it('counts successes and failures', () => {
			expect(
				summarize([
					{ type: 'scene', id: 'a', success: true },
					{ type: 'scene', id: 'b', success: false, code: 'forbidden' },
					{ type: 'folder', id: 'c', success: true }
				])
			).toEqual({ total: 3, succeeded: 2, failed: 1 })
		})

		it('handles an empty list', () => {
			expect(summarize([])).toEqual({ total: 0, succeeded: 0, failed: 0 })
		})
	})
})
