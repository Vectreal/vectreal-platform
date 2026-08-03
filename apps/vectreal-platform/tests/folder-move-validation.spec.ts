import {
	MAX_FOLDER_DEPTH,
	validateFolderMove,
	validateSceneMove
} from '../app/lib/domain/dashboard/folder-move'

/**
 * A tree used by most cases:
 *
 *   root-a (0)          root-b (0)
 *     child-a (1)
 *       grandchild-a (2)
 */
const DEPTHS = new Map([
	['root-a', 0],
	['root-b', 0],
	['child-a', 1],
	['grandchild-a', 2]
])

function moveRootA(
	targetParentId: string | null,
	overrides: Partial<Parameters<typeof validateFolderMove>[0]> = {}
) {
	return validateFolderMove({
		folderId: 'root-a',
		currentParentId: null,
		targetParentId,
		descendantIds: new Set(['child-a', 'grandchild-a']),
		depthById: DEPTHS,
		...overrides
	})
}

describe('folder move validation', () => {
	describe('structural rules', () => {
		it('rejects moving a folder into itself', () => {
			const result = moveRootA('root-a')

			expect(result.ok).toBe(false)
			expect(result.ok === false && result.reason).toBe('self-parent')
		})

		it('rejects moving a folder into its direct child', () => {
			const result = moveRootA('child-a')

			expect(result.ok === false && result.reason).toBe('descendant-parent')
		})

		it('rejects moving a folder into a deeper descendant', () => {
			const result = moveRootA('grandchild-a')

			expect(result.ok === false && result.reason).toBe('descendant-parent')
		})

		it('reports self-parent rather than same-parent when both apply', () => {
			// A root-level folder dropped onto itself matches both rules; the
			// specific one is the useful message.
			const result = validateFolderMove({
				folderId: 'root-a',
				currentParentId: 'root-a',
				targetParentId: 'root-a',
				descendantIds: new Set(),
				depthById: DEPTHS
			})

			expect(result.ok === false && result.reason).toBe('self-parent')
		})
	})

	describe('accepted moves', () => {
		it('accepts a move to a sibling', () => {
			expect(moveRootA('root-b').ok).toBe(true)
		})

		it('accepts a move to the project root', () => {
			const result = validateFolderMove({
				folderId: 'child-a',
				currentParentId: 'root-a',
				targetParentId: null,
				descendantIds: new Set(['grandchild-a']),
				depthById: DEPTHS
			})

			expect(result.ok).toBe(true)
		})
	})

	describe('no-ops', () => {
		it('reports a move to the current parent as same-parent', () => {
			const result = validateFolderMove({
				folderId: 'child-a',
				currentParentId: 'root-a',
				targetParentId: 'root-a',
				descendantIds: new Set(),
				depthById: DEPTHS
			})

			expect(result.ok === false && result.reason).toBe('same-parent')
		})

		it('reports a root folder moved to root as same-parent', () => {
			expect(moveRootA(null).ok === false && moveRootA(null).reason).toBe(
				'same-parent'
			)
		})
	})

	describe('project boundaries', () => {
		it('rejects a cross-project target before anything else', () => {
			const result = moveRootA('root-b', { targetIsCrossProject: true })

			expect(result.ok === false && result.reason).toBe('cross-project')
		})
	})

	describe('depth cap', () => {
		it('rejects a move that would push the subtree past the limit', () => {
			// A chain deep enough that re-parenting a two-level subtree under its
			// tip exceeds the cap.
			const deepId = 'deep'
			const depths = new Map([
				[deepId, MAX_FOLDER_DEPTH - 1],
				['mover', 0],
				['mover-child', 1]
			])

			const result = validateFolderMove({
				folderId: 'mover',
				currentParentId: null,
				targetParentId: deepId,
				descendantIds: new Set(['mover-child']),
				depthById: depths
			})

			expect(result.ok === false && result.reason).toBe('too-deep')
		})

		it('accepts a move that lands exactly on the limit', () => {
			const depths = new Map([
				['deep', MAX_FOLDER_DEPTH - 2],
				['mover', 0],
				['mover-child', 1]
			])

			const result = validateFolderMove({
				folderId: 'mover',
				currentParentId: null,
				targetParentId: 'deep',
				descendantIds: new Set(['mover-child']),
				depthById: depths
			})

			expect(result.ok).toBe(true)
		})

		it('measures subtree height relative to the folder, not absolutely', () => {
			// `child-a` sits at depth 1 with one level below it, so moving it to
			// root leaves a max depth of 1 - nowhere near the cap.
			const result = validateFolderMove({
				folderId: 'child-a',
				currentParentId: 'root-a',
				targetParentId: null,
				descendantIds: new Set(['grandchild-a']),
				depthById: DEPTHS
			})

			expect(result.ok).toBe(true)
		})

		it('fails closed when a descendant has no known depth', () => {
			// Both sets describe the same project, so this can only happen if the
			// tree is already inconsistent. Refusing beats measuring a subtree that
			// is shorter than it really is and nesting past the read cap.
			const result = validateFolderMove({
				folderId: 'child-a',
				currentParentId: 'root-a',
				targetParentId: 'root-b',
				descendantIds: new Set(['grandchild-a', 'ghost']),
				depthById: DEPTHS
			})

			expect(result.ok === false && result.reason).toBe('too-deep')
		})
	})

	describe('messages', () => {
		it('explains every rejection in words a user can act on', () => {
			const rejections = [
				moveRootA('root-a'),
				moveRootA('child-a'),
				moveRootA(null),
				moveRootA('root-b', { targetIsCrossProject: true })
			]

			for (const result of rejections) {
				expect(result.ok).toBe(false)
				expect(result.ok === false && result.message.length).toBeGreaterThan(0)
			}
		})
	})
})

describe('scene move validation', () => {
	it('accepts a move to another folder', () => {
		expect(
			validateSceneMove({ currentFolderId: 'a', targetFolderId: 'b' }).ok
		).toBe(true)
	})

	it('accepts a move to the project root', () => {
		expect(
			validateSceneMove({ currentFolderId: 'a', targetFolderId: null }).ok
		).toBe(true)
	})

	it('reports a move to the current folder as same-parent', () => {
		const result = validateSceneMove({
			currentFolderId: 'a',
			targetFolderId: 'a'
		})

		expect(result.ok === false && result.reason).toBe('same-parent')
	})

	it('treats a root-to-root move as a no-op', () => {
		const result = validateSceneMove({
			currentFolderId: null,
			targetFolderId: null
		})

		expect(result.ok === false && result.reason).toBe('same-parent')
	})

	it('rejects a cross-project target', () => {
		const result = validateSceneMove({
			currentFolderId: 'a',
			targetFolderId: 'b',
			targetIsCrossProject: true
		})

		expect(result.ok === false && result.reason).toBe('cross-project')
	})
})
