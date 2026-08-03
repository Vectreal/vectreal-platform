import {
	getRouteContext,
	identifyDrawerRoute,
	isListScopedProjectEditPath,
	isProjectEditPath,
	parseRouteParams
} from '../app/components/dashboard/utils'
import { isDashboardOverlayPath } from '../app/lib/navigation/dashboard-route-behavior'

const PROJECT_ID = '11111111-1111-4111-8111-111111111111'
const SCENE_ID = '22222222-2222-4222-8222-222222222222'
const OTHER_PROJECT_ID = '33333333-3333-4333-8333-333333333333'

const LIST_EDIT = `/dashboard/projects/edit/${PROJECT_ID}`
const NESTED_EDIT = `/dashboard/projects/${PROJECT_ID}/edit`
const SCENE_DETAIL = `/dashboard/projects/${PROJECT_ID}/${SCENE_ID}`

/**
 * `/dashboard/projects/edit/:projectId` is positionally identical to
 * `/dashboard/projects/:projectId/:sceneId`, and `parseRouteParams` reads
 * segments by index. Every consumer that resolves a dashboard route has to know
 * the difference; this is the net for all of them.
 */
describe('list-scoped project edit route', () => {
	describe('getRouteContext', () => {
		it('resolves the list-scoped edit path as the projects list, not a scene', () => {
			expect(getRouteContext(LIST_EDIT, parseRouteParams(LIST_EDIT))).toBe(
				'project-list'
			)
		})

		it('still resolves a real scene path as a scene', () => {
			expect(
				getRouteContext(SCENE_DETAIL, parseRouteParams(SCENE_DETAIL))
			).toBe('scene-detail')
		})

		it('still resolves the nested edit path as the project detail', () => {
			expect(getRouteContext(NESTED_EDIT, parseRouteParams(NESTED_EDIT))).toBe(
				'project-detail'
			)
		})

		it('leaves the bare list and project detail alone', () => {
			expect(
				getRouteContext(
					'/dashboard/projects',
					parseRouteParams('/dashboard/projects')
				)
			).toBe('project-list')
			expect(
				getRouteContext(
					`/dashboard/projects/${PROJECT_ID}`,
					parseRouteParams(`/dashboard/projects/${PROJECT_ID}`)
				)
			).toBe('project-detail')
		})
	})

	describe('identifyDrawerRoute', () => {
		it('recognizes both edit shapes', () => {
			expect(identifyDrawerRoute(LIST_EDIT)).toBe(true)
			expect(identifyDrawerRoute(NESTED_EDIT)).toBe(true)
		})

		it('does not treat a scene path as a drawer', () => {
			expect(identifyDrawerRoute(SCENE_DETAIL)).toBe(false)
		})

		it('still recognizes the other drawers', () => {
			expect(identifyDrawerRoute('/dashboard/projects/new')).toBe(true)
			expect(identifyDrawerRoute('/dashboard/api-keys/new')).toBe(true)
		})
	})

	describe('isDashboardOverlayPath', () => {
		it('covers both edit shapes, so neither renders a skeleton over the drawer', () => {
			expect(isDashboardOverlayPath(LIST_EDIT)).toBe(true)
			expect(isDashboardOverlayPath(NESTED_EDIT)).toBe(true)
		})

		it('does not cover a scene path', () => {
			expect(isDashboardOverlayPath(SCENE_DETAIL)).toBe(false)
		})
	})

	describe('isListScopedProjectEditPath', () => {
		it('matches only the list-scoped shape', () => {
			expect(isListScopedProjectEditPath(LIST_EDIT)).toBe(true)
			expect(isListScopedProjectEditPath(NESTED_EDIT)).toBe(false)
			expect(isListScopedProjectEditPath(SCENE_DETAIL)).toBe(false)
		})

		it('does not match a deeper path', () => {
			expect(
				isListScopedProjectEditPath(`/dashboard/projects/edit/${PROJECT_ID}/x`)
			).toBe(false)
		})
	})

	describe('isProjectEditPath', () => {
		it('matches either shape for the given project', () => {
			expect(isProjectEditPath(LIST_EDIT, PROJECT_ID)).toBe(true)
			expect(isProjectEditPath(NESTED_EDIT, PROJECT_ID)).toBe(true)
		})

		it('does not match a different project, so one drawer cannot open for another', () => {
			expect(isProjectEditPath(LIST_EDIT, OTHER_PROJECT_ID)).toBe(false)
			expect(isProjectEditPath(NESTED_EDIT, OTHER_PROJECT_ID)).toBe(false)
		})

		it('does not match a scene path', () => {
			expect(isProjectEditPath(SCENE_DETAIL, PROJECT_ID)).toBe(false)
		})
	})
})
