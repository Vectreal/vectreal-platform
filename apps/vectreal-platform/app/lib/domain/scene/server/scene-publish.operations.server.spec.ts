import { beforeEach, describe, expect, it, vi } from 'vitest'

import { publishScene } from './scene-publish.operations.server'

const mocks = vi.hoisted(() => ({
	userExists: vi.fn(),
	getProject: vi.fn(),
	hasEntitlement: vi.fn(),
	reclaimUploadBatch: vi.fn(),
	publishSceneFromAssetId: vi.fn(),
	getProjectIdFromScene: vi.fn()
}))

vi.mock('../../user/user-repository.server', () => ({
	userExists: mocks.userExists
}))
vi.mock('../../project/project-repository.server', () => ({
	getProject: mocks.getProject
}))
vi.mock('../../billing/entitlement-service.server', () => ({
	hasEntitlement: mocks.hasEntitlement,
	getRecommendedUpgrade: () => 'pro',
	getQuotaLimit: vi.fn()
}))
vi.mock('../../billing/quota-enforcement.server', () => ({
	assertWithinQuota: vi.fn()
}))
vi.mock('../../asset/asset-reclaim.server', () => ({
	reclaimUploadBatch: mocks.reclaimUploadBatch
}))
vi.mock('../../observability/report-server-error.server', () => ({
	reportServerError: vi.fn()
}))
vi.mock('../../../../db/client', () => ({ getDbClient: () => ({}) }))
vi.mock('./scene-settings-service.server', () => ({
	sceneSettingsService: {
		getProjectIdFromScene: mocks.getProjectIdFromScene,
		publishSceneFromAssetId: mocks.publishSceneFromAssetId
	}
}))

const request = {
	action: 'commit-scene-publish',
	sceneId: 'scene-1',
	publishedAssetId: 'asset-1',
	requestId: 'request-1'
}

beforeEach(() => {
	for (const fn of Object.values(mocks)) fn.mockReset()
	mocks.userExists.mockResolvedValue(true)
	mocks.getProjectIdFromScene.mockResolvedValue('project-1')
	mocks.getProject.mockResolvedValue({ organizationId: 'org-1' })
	mocks.reclaimUploadBatch.mockResolvedValue([])
})

describe('publishScene, the browser commit', () => {
	/*
	  Returned, not thrown: the route's request guard records an outcome only
	  for a returned response, so a thrown refusal would leave the request's
	  reservation pending forever.
	*/
	it.each([
		[
			'read-only billing',
			'unpaid',
			402,
			'Publishing is unavailable: payment required to restore access.'
		],
		[
			'a plan without publishing',
			'none',
			403,
			'Publishing is not available on your current plan.'
		]
	])(
		'returns the refusal for %s, publishes nothing and reclaims the upload',
		async (_, billingState, status, message) => {
			mocks.hasEntitlement.mockResolvedValue({
				granted: false,
				effectivePlan: 'free',
				billingState
			})

			const response = await publishScene(request, 'user-1')

			expect(response.status).toBe(status)
			expect(await response.json()).toMatchObject({
				success: false,
				error: message
			})
			expect(mocks.publishSceneFromAssetId).not.toHaveBeenCalled()
			expect(mocks.reclaimUploadBatch).toHaveBeenCalledWith({
				requestId: 'request-1',
				projectId: 'project-1',
				keepAssetIds: []
			})
		}
	)
})
