import { beforeEach, describe, expect, it, vi } from 'vitest'

import { IMG_TO_3D_FIELDS, type ImgTo3dJobState } from './img-to-3d-contract'
import {
	handleImgTo3dGenerationArtifact,
	handleImgTo3dGenerationStatus,
	handleSubmitImgTo3dGeneration,
	ImgTo3dRuntimeError,
	type ImgTo3dHandlerDeps,
	type ImgTo3dJobRecord,
	type ImgTo3dRuntime
} from './img-to-3d-handlers'

import type { User } from '@supabase/supabase-js'

const ENDPOINT = 'https://vectreal.test/api/img-to-3d/generations'
const OTHER_ORG_JOB = '99999999-9999-4999-8999-999999999999'

function uuid(n: number): string {
	return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
}

function harness(overrides: Partial<ImgTo3dHandlerDeps> = {}) {
	const rows = new Map<string, ImgTo3dJobRecord>([
		[
			OTHER_ORG_JOB,
			{
				id: OTHER_ORG_JOB,
				organizationId: 'org-2',
				createdBy: 'user-2',
				batchId: uuid(900),
				seed: 1,
				params: { resolution: 1024, textureSize: 2048, decimationTarget: 1e5 }
			}
		]
	])
	const runtime = {
		submit: vi.fn<ImgTo3dRuntime['submit']>(async () => undefined),
		status: vi.fn<ImgTo3dRuntime['status']>(
			async (jobId): Promise<ImgTo3dJobState> => ({
				jobId,
				status: 'processing',
				progress: 40,
				message: 'Baking PBR textures',
				artifactReady: false,
				pollAfterMs: 1_000
			})
		),
		artifact: vi.fn<ImgTo3dRuntime['artifact']>(
			async () => new Response('glb-bytes')
		)
	}
	const jobs = {
		insert: vi.fn(async (records: readonly ImgTo3dJobRecord[]) => {
			for (const record of records) rows.set(record.id, record)
		}),
		findForOrganization: vi.fn(async (jobId: string, organizationId: string) =>
			rows.get(jobId)?.organizationId === organizationId ? { id: jobId } : null
		),
		remove: vi.fn(async (jobId: string) => {
			rows.delete(jobId)
		})
	}
	let ids = 0
	let seeds = 100
	const deps: ImgTo3dHandlerDeps = {
		authenticate: async () => ({
			user: { id: 'user-1', email: 'me@vectreal.com' } as User,
			headers: [
				['Set-Cookie', 'sb-access=rotated'],
				['Set-Cookie', 'sb-refresh=rotated']
			]
		}),
		resolveAccess: vi.fn(async () => ({ organizationId: 'org-1' })),
		validateCsrf: async () => null,
		jobs,
		runtime: () => runtime,
		newId: () => uuid(++ids),
		newSeed: () => ++seeds,
		...overrides
	}
	return { deps, rows, runtime, jobs }
}

function submission(seedCount = '3'): Request {
	const body = new FormData()
	body.set(
		IMG_TO_3D_FIELDS.image,
		new File([new Uint8Array(16)], 'chair.png', { type: 'image/png' })
	)
	body.set(IMG_TO_3D_FIELDS.resolution, '1024')
	body.set(IMG_TO_3D_FIELDS.textureSize, '2048')
	body.set(IMG_TO_3D_FIELDS.decimationTarget, '200000')
	body.set(IMG_TO_3D_FIELDS.seedCount, seedCount)
	return new Request(ENDPOINT, { method: 'POST', body })
}

async function readBody(response: Response) {
	return (await response.json()) as {
		success: boolean
		data?: unknown
		error?: unknown
	}
}

beforeEach(() => {
	// The handlers log every runtime failure with its detail; that is asserted
	// where it matters and silenced everywhere else.
	vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

describe('a caller the gate refuses', () => {
	const routes = [
		[
			'submit',
			(deps: ImgTo3dHandlerDeps) =>
				handleSubmitImgTo3dGeneration(submission(), deps)
		],
		[
			'status',
			(deps: ImgTo3dHandlerDeps) =>
				handleImgTo3dGenerationStatus(new Request(ENDPOINT), uuid(1), deps)
		],
		[
			'artifact',
			(deps: ImgTo3dHandlerDeps) =>
				handleImgTo3dGenerationArtifact(new Request(ENDPOINT), uuid(1), deps)
		]
	] as const

	it.each(routes)(
		'gets a 404 from %s, and nothing reaches the jobs or the runtime',
		async (_, call) => {
			const { deps, runtime, jobs } = harness({
				resolveAccess: async () => null
			})

			const response = await call(deps)

			expect(response.status).toBe(404)
			expect(jobs.insert).not.toHaveBeenCalled()
			expect(jobs.findForOrganization).not.toHaveBeenCalled()
			expect(runtime.submit).not.toHaveBeenCalled()
			expect(runtime.status).not.toHaveBeenCalled()
			expect(runtime.artifact).not.toHaveBeenCalled()
		}
	)

	it.each(routes)(
		'keeps every rotated auth cookie on the %s 404',
		async (_, call) => {
			const { deps } = harness({ resolveAccess: async () => null })

			const response = await call(deps)

			expect(response.headers.getSetCookie()).toEqual([
				'sb-access=rotated',
				'sb-refresh=rotated'
			])
		}
	)

	it.each(routes)(
		'passes an unauthenticated %s through untouched',
		async (_, call) => {
			const redirect = new Response(null, { status: 401 })
			const { deps } = harness({ authenticate: async () => redirect })

			expect(await call(deps)).toBe(redirect)
		}
	)
})

describe('handleSubmitImgTo3dGeneration', () => {
	it('answers anything but POST with 405', async () => {
		const { deps } = harness()
		const response = await handleSubmitImgTo3dGeneration(
			new Request(ENDPOINT),
			deps
		)
		expect(response.status).toBe(405)
	})

	it('records nothing when the CSRF check fails', async () => {
		const refusal = new Response(null, { status: 403 })
		const { deps, jobs, runtime } = harness({
			validateCsrf: async () => refusal
		})

		const response = await handleSubmitImgTo3dGeneration(submission(), deps)

		expect(response.status).toBe(403)
		expect(jobs.insert).not.toHaveBeenCalled()
		expect(runtime.submit).not.toHaveBeenCalled()
	})

	it('answers invalid settings with their kind', async () => {
		const { deps, jobs } = harness()

		const response = await handleSubmitImgTo3dGeneration(submission('4'), deps)

		expect(response.status).toBe(400)
		expect(await readBody(response)).toMatchObject({
			error: 'invalid_settings'
		})
		expect(jobs.insert).not.toHaveBeenCalled()
	})

	it('records one job per seed for the payer, then starts each', async () => {
		const { deps, rows, runtime } = harness()

		const response = await handleSubmitImgTo3dGeneration(submission(), deps)

		expect(response.status).toBe(202)
		expect(response.headers.getSetCookie()).toHaveLength(2)
		const { data } = await readBody(response)
		expect(data).toEqual({
			batchId: uuid(1),
			jobs: [
				{ jobId: uuid(2), seed: 101, status: 'queued', error: null },
				{ jobId: uuid(3), seed: 102, status: 'queued', error: null },
				{ jobId: uuid(4), seed: 103, status: 'queued', error: null }
			]
		})
		expect(rows.get(uuid(2))).toEqual({
			id: uuid(2),
			organizationId: 'org-1',
			createdBy: 'user-1',
			batchId: uuid(1),
			seed: 101,
			params: { resolution: 1024, textureSize: 2048, decimationTarget: 200_000 }
		})
		expect(runtime.submit).toHaveBeenCalledTimes(3)
		expect(runtime.submit).toHaveBeenCalledWith(
			expect.objectContaining({
				jobId: uuid(3),
				seed: 102,
				resolution: 1024,
				textureSize: 2048,
				decimationTarget: 200_000
			})
		)
	})

	it('never runs the same seed twice in one batch', async () => {
		const repeated = [7, 7, 7, 8, 7, 9]
		const { deps, runtime } = harness({ newSeed: () => repeated.shift()! })

		await handleSubmitImgTo3dGeneration(submission(), deps)

		expect(runtime.submit.mock.calls.map(([job]) => job.seed)).toEqual([
			7, 8, 9
		])
	})

	it('removes a job the runtime refused and reports it by kind, not detail', async () => {
		const { deps, rows, runtime } = harness()
		runtime.submit.mockImplementation(async ({ jobId }) => {
			if (jobId === uuid(3)) {
				throw new ImgTo3dRuntimeError(
					'runtime_rejected',
					422,
					'pydantic: image unreadable'
				)
			}
		})

		const response = await handleSubmitImgTo3dGeneration(submission(), deps)

		expect(response.status).toBe(202)
		const { data } = (await readBody(response)) as {
			data: { jobs: { jobId: string; status: string; error: unknown }[] }
		}
		expect(data.jobs[1]).toEqual({
			jobId: uuid(3),
			seed: 102,
			status: 'failed',
			error: 'runtime_rejected'
		})
		expect(JSON.stringify(data)).not.toContain('pydantic')
		expect(rows.has(uuid(3))).toBe(false)
		expect(rows.has(uuid(2))).toBe(true)
	})

	it('keeps a job whose submit timed out, since the runtime may be running it', async () => {
		const { deps, rows, runtime, jobs } = harness()
		runtime.submit.mockRejectedValue(
			new ImgTo3dRuntimeError(
				'runtime_unavailable',
				503,
				'/generations did not answer',
				true
			)
		)

		const response = await handleSubmitImgTo3dGeneration(submission('1'), deps)

		expect(response.status).toBe(202)
		const { data } = (await readBody(response)) as {
			data: { jobs: { status: string; error: unknown }[] }
		}
		expect(data.jobs).toEqual([
			{ jobId: uuid(2), seed: 101, status: 'queued', error: null }
		])
		expect(rows.has(uuid(2))).toBe(true)
		expect(jobs.remove).not.toHaveBeenCalled()
	})

	it('still reports the variants that started when removing a refused one fails', async () => {
		const { deps, runtime, jobs } = harness()
		runtime.submit.mockImplementation(async ({ jobId }) => {
			if (jobId === uuid(2)) {
				throw new ImgTo3dRuntimeError('runtime_rejected', 422)
			}
		})
		jobs.remove.mockRejectedValue(new Error('connection terminated'))

		const response = await handleSubmitImgTo3dGeneration(submission(), deps)

		expect(response.status).toBe(202)
		const { data } = (await readBody(response)) as {
			data: { jobs: { status: string }[] }
		}
		expect(data.jobs.map((job) => job.status)).toEqual([
			'failed',
			'queued',
			'queued'
		])
	})

	it('fails the request only when every job was refused', async () => {
		const { deps, rows, runtime } = harness()
		runtime.submit.mockRejectedValue(new Error('socket hang up'))

		const response = await handleSubmitImgTo3dGeneration(submission(), deps)

		expect(response.status).toBe(502)
		expect(await readBody(response)).toMatchObject({ error: 'unexpected' })
		expect([...rows.keys()]).toEqual([OTHER_ORG_JOB])
	})
})

describe('handleImgTo3dGenerationStatus', () => {
	it('answers 404 for another organization’s job without asking the runtime', async () => {
		const { deps, runtime } = harness()

		const response = await handleImgTo3dGenerationStatus(
			new Request(ENDPOINT),
			OTHER_ORG_JOB,
			deps
		)

		expect(response.status).toBe(404)
		expect(runtime.status).not.toHaveBeenCalled()
	})

	it('answers 404 for a malformed id without querying', async () => {
		const { deps, jobs } = harness()

		for (const jobId of ['not-a-uuid', undefined, `${uuid(1)}x`]) {
			const response = await handleImgTo3dGenerationStatus(
				new Request(ENDPOINT),
				jobId,
				deps
			)
			expect(response.status).toBe(404)
		}
		expect(jobs.findForOrganization).not.toHaveBeenCalled()
	})

	it('reports an owned job’s state', async () => {
		const { deps } = harness()
		await handleSubmitImgTo3dGeneration(submission('1'), deps)

		const response = await handleImgTo3dGenerationStatus(
			new Request(ENDPOINT),
			uuid(2),
			deps
		)

		expect(response.status).toBe(200)
		expect(response.headers.getSetCookie()).toHaveLength(2)
		expect((await readBody(response)).data).toMatchObject({
			jobId: uuid(2),
			status: 'processing',
			message: 'Baking PBR textures'
		})
	})

	it('logs a failed job’s runtime detail and never sends it on', async () => {
		const { deps, runtime } = harness()
		await handleSubmitImgTo3dGeneration(submission('1'), deps)
		runtime.status.mockResolvedValue({
			jobId: uuid(2),
			status: 'failed',
			progress: null,
			message: 'torch.OutOfMemoryError: CUDA out of memory',
			artifactReady: false,
			pollAfterMs: 0
		})

		const response = await handleImgTo3dGenerationStatus(
			new Request(ENDPOINT),
			uuid(2),
			deps
		)

		expect((await readBody(response)).data).toMatchObject({
			status: 'failed',
			message: null
		})
		expect(console.error).toHaveBeenCalledWith(
			expect.stringContaining('CUDA out of memory')
		)
	})

	it('answers a runtime failure with its status and kind only', async () => {
		const { deps, runtime } = harness()
		await handleSubmitImgTo3dGeneration(submission('1'), deps)
		runtime.status.mockRejectedValue(
			new ImgTo3dRuntimeError(
				'runtime_unavailable',
				503,
				'/generations/x could not be reached'
			)
		)

		const response = await handleImgTo3dGenerationStatus(
			new Request(ENDPOINT),
			uuid(2),
			deps
		)

		expect(response.status).toBe(503)
		expect(await readBody(response)).toEqual({
			success: false,
			error: 'runtime_unavailable'
		})
	})
})

describe('handleImgTo3dGenerationArtifact', () => {
	it('answers 404 for another organization’s job without asking the runtime', async () => {
		const { deps, runtime } = harness()

		const response = await handleImgTo3dGenerationArtifact(
			new Request(ENDPOINT),
			OTHER_ORG_JOB,
			deps
		)

		expect(response.status).toBe(404)
		expect(runtime.artifact).not.toHaveBeenCalled()
	})

	it('streams an owned model through as an uncached GLB', async () => {
		const { deps } = harness()
		await handleSubmitImgTo3dGeneration(submission('1'), deps)

		const response = await handleImgTo3dGenerationArtifact(
			new Request(ENDPOINT),
			uuid(2),
			deps
		)

		expect(response.status).toBe(200)
		expect(response.headers.get('Content-Type')).toBe('model/gltf-binary')
		expect(response.headers.get('Cache-Control')).toBe('no-store')
		expect(response.headers.getSetCookie()).toHaveLength(2)
		expect(await response.text()).toBe('glb-bytes')
	})
})
