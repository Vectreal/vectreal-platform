import { apiFailureSchema } from '@vctrl/sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { fingerprintRequest } from './agent-idempotency'
import {
	IDEMPOTENCY_KEY_TTL_MS,
	STALE_CLAIM_MS,
	withIdempotency
} from './agent-idempotency.server'

const repository = vi.hoisted(() => ({
	purgeExpiredIdempotencyKeys: vi.fn(),
	claimIdempotencyKey: vi.fn(),
	findIdempotencyKey: vi.fn(),
	reclaimStaleIdempotencyKey: vi.fn(),
	completeIdempotencyKey: vi.fn(),
	releaseIdempotencyKey: vi.fn(),
	inIdempotencyTransaction: vi.fn()
}))
const reportServerError = vi.hoisted(() => vi.fn())

vi.mock('./agent-idempotency-repository.server', () => repository)
vi.mock('../../observability/report-server-error.server', () => ({
	reportServerError
}))

const payload = { name: 'Chairs' }
const tx = { transaction: 'tx' }
const claim = { grantId: 'g1', key: 'key-1', claimId: 'claim-1' }
/** What the transaction did: committed, or rolled back by a throw. */
let committed: boolean | undefined

function request(key: string | null = '"key-1"') {
	return new Request('https://vectreal.com/api/v1/projects', {
		method: 'POST',
		headers: key === null ? {} : { 'Idempotency-Key': key }
	})
}

const created = async () =>
	Response.json({ success: true, data: { id: 'p1' } }, { status: 201 })

async function refusal(promise: Promise<unknown>) {
	const thrown = await promise.then(
		() => null,
		(error: unknown) => error
	)
	expect(thrown).toBeInstanceOf(Response)
	return thrown as Response
}

const held = (
	statusCode: number | null,
	fingerprint = fingerprintRequest(request(), payload)
) => {
	repository.claimIdempotencyKey.mockResolvedValue(null)
	repository.findIdempotencyKey.mockResolvedValue({
		...claim,
		fingerprint,
		statusCode,
		responseBody:
			statusCode === null ? null : { success: true, data: { id: 'p1' } }
	})
}

beforeEach(() => {
	for (const fn of Object.values(repository))
		fn.mockReset().mockResolvedValue(undefined)
	repository.claimIdempotencyKey.mockResolvedValue(claim)
	repository.completeIdempotencyKey.mockResolvedValue(true)
	committed = undefined
	repository.inIdempotencyTransaction.mockImplementation(
		async (run: (t: typeof tx) => Promise<unknown>) => {
			try {
				const result = await run(tx)
				committed = true
				return result
			} catch (error) {
				committed = false
				throw error
			}
		}
	)
	reportServerError.mockReset()
})

describe('withIdempotency', () => {
	it('refuses a request without a key with 400 and runs nothing', async () => {
		const run = vi.fn(created)

		const response = await refusal(
			withIdempotency({ grantId: 'g1', request: request(null), payload }, run)
		)

		expect(response.status).toBe(400)
		expect(apiFailureSchema.parse(await response.json()).code).toBe(
			'invalid_request'
		)
		expect(run).not.toHaveBeenCalled()
		expect(repository.claimIdempotencyKey).not.toHaveBeenCalled()
	})

	it('runs a new key once in a transaction that also keeps its outcome', async () => {
		const run = vi.fn(created)
		const req = request()

		const response = await withIdempotency(
			{ grantId: 'g1', request: req, payload },
			run
		)

		expect(response.status).toBe(201)
		expect(run).toHaveBeenCalledExactlyOnceWith(tx)
		expect(repository.purgeExpiredIdempotencyKeys).toHaveBeenCalledWith(
			'g1',
			IDEMPOTENCY_KEY_TTL_MS
		)
		expect(repository.claimIdempotencyKey).toHaveBeenCalledWith({
			grantId: 'g1',
			key: 'key-1',
			fingerprint: fingerprintRequest(req, payload)
		})
		expect(repository.completeIdempotencyKey).toHaveBeenCalledWith(tx, claim, {
			statusCode: 201,
			responseBody: { success: true, data: { id: 'p1' } }
		})
		expect(committed).toBe(true)
	})

	it('answers a finished key with its kept outcome, marked as replayed, without running', async () => {
		held(201)
		const run = vi.fn(created)

		const response = await withIdempotency(
			{ grantId: 'g1', request: request(), payload },
			run
		)

		expect(run).not.toHaveBeenCalled()
		expect(response.status).toBe(201)
		expect(response.headers.get('Idempotent-Replayed')).toBe('true')
		await expect(response.json()).resolves.toEqual({
			success: true,
			data: { id: 'p1' }
		})
	})

	it('refuses the same key with a different request with 422', async () => {
		held(201, fingerprintRequest(request(), { name: 'Tables' }))
		const run = vi.fn(created)

		const response = await refusal(
			withIdempotency({ grantId: 'g1', request: request(), payload }, run)
		)

		expect(response.status).toBe(422)
		expect(apiFailureSchema.parse(await response.json()).code).toBe(
			'idempotency_key_reused'
		)
		expect(run).not.toHaveBeenCalled()
	})

	it('refuses a key whose first request is still running with 409', async () => {
		held(null)
		repository.reclaimStaleIdempotencyKey.mockResolvedValue(null)
		const run = vi.fn(created)

		const response = await refusal(
			withIdempotency({ grantId: 'g1', request: request(), payload }, run)
		)

		expect(response.status).toBe(409)
		expect(apiFailureSchema.parse(await response.json()).code).toBe(
			'idempotency_in_progress'
		)
		expect(repository.reclaimStaleIdempotencyKey).toHaveBeenCalledWith(
			{ grantId: 'g1', key: 'key-1' },
			STALE_CLAIM_MS
		)
		expect(run).not.toHaveBeenCalled()
	})

	it('runs under the new claim after taking over an abandoned one', async () => {
		held(null)
		const taken = { ...claim, claimId: 'claim-2' }
		repository.reclaimStaleIdempotencyKey.mockResolvedValue(taken)

		const response = await withIdempotency(
			{ grantId: 'g1', request: request(), payload },
			created
		)

		expect(response.status).toBe(201)
		expect(repository.completeIdempotencyKey).toHaveBeenCalledWith(
			tx,
			taken,
			expect.anything()
		)
	})

	it('rolls back with 409 when its claim was taken over meanwhile, and leaves the key alone', async () => {
		repository.completeIdempotencyKey.mockResolvedValue(false)

		const response = await refusal(
			withIdempotency({ grantId: 'g1', request: request(), payload }, created)
		)

		expect(response.status).toBe(409)
		expect(committed).toBe(false)
		expect(repository.releaseIdempotencyKey).not.toHaveBeenCalled()
	})

	it('keeps a refusal the mutation returned, as the draft says to replay errors too', async () => {
		const response = await withIdempotency(
			{ grantId: 'g1', request: request(), payload },
			async () =>
				Response.json(
					{ success: false, error: 'limit', code: 'quota_exceeded' },
					{ status: 403 }
				)
		)

		expect(response.status).toBe(403)
		expect(committed).toBe(true)
		expect(repository.completeIdempotencyKey).toHaveBeenCalledWith(
			tx,
			claim,
			expect.objectContaining({ statusCode: 403 })
		)
	})

	it('rolls back a 5xx and releases the key, so the retry runs', async () => {
		const response = await withIdempotency(
			{ grantId: 'g1', request: request(), payload },
			async () => new Response('boom', { status: 503 })
		)

		expect(response.status).toBe(503)
		expect(committed).toBe(false)
		expect(repository.releaseIdempotencyKey).toHaveBeenCalledWith(claim)
		expect(repository.completeIdempotencyKey).not.toHaveBeenCalled()
	})

	it('rolls back, releases the key and rethrows when the mutation throws', async () => {
		const failure = new Error('database down')

		await expect(
			withIdempotency(
				{ grantId: 'g1', request: request(), payload },
				async () => {
					throw failure
				}
			)
		).rejects.toBe(failure)
		expect(committed).toBe(false)
		expect(repository.releaseIdempotencyKey).toHaveBeenCalledWith(claim)
	})

	it('rolls back the mutation when its outcome cannot be kept, so a retry runs it once', async () => {
		const failure = new Error('write failed')
		repository.completeIdempotencyKey.mockRejectedValue(failure)

		await expect(
			withIdempotency({ grantId: 'g1', request: request(), payload }, created)
		).rejects.toBe(failure)
		expect(committed).toBe(false)
		expect(repository.releaseIdempotencyKey).toHaveBeenCalledWith(claim)
	})
})

describe('withIdempotency with a staged mutation', () => {
	const attempt = { claimId: 'claim-1' }

	function staged(run = vi.fn(created)) {
		return {
			prepare: vi.fn(async () => ({ sceneId: 's1' })),
			run,
			undo: vi.fn(async () => undefined)
		}
	}

	const post = (mutation: ReturnType<typeof staged>) =>
		withIdempotency({ grantId: 'g1', request: request(), payload }, mutation)

	it('prepares once under the claim before the transaction opens, and undoes nothing on commit', async () => {
		const mutation = staged()

		const response = await post(mutation)

		expect(response.status).toBe(201)
		expect(mutation.prepare).toHaveBeenCalledExactlyOnceWith(attempt)
		expect(mutation.prepare.mock.invocationCallOrder[0]).toBeLessThan(
			repository.inIdempotencyTransaction.mock.invocationCallOrder[0]
		)
		expect(mutation.run).toHaveBeenCalledExactlyOnceWith(tx, { sceneId: 's1' })
		expect(committed).toBe(true)
		expect(mutation.undo).not.toHaveBeenCalled()
	})

	it('keeps a refusal from prepare without running, then undoes the attempt', async () => {
		const mutation = staged()
		mutation.prepare.mockRejectedValue(
			Response.json(
				{ success: false, error: 'limit', code: 'quota_exceeded' },
				{ status: 403 }
			)
		)

		const response = await post(mutation)

		expect(response.status).toBe(403)
		expect(mutation.run).not.toHaveBeenCalled()
		expect(repository.completeIdempotencyKey).toHaveBeenCalledWith(
			tx,
			claim,
			expect.objectContaining({ statusCode: 403 })
		)
		expect(mutation.undo).toHaveBeenCalledExactlyOnceWith(attempt)
	})

	it('keeps a refusal from run and undoes the attempt, whose files nothing links', async () => {
		const mutation = staged(
			vi.fn(async () =>
				Response.json(
					{ success: false, error: 'no', code: 'invalid_request' },
					{ status: 400 }
				)
			)
		)

		const response = await post(mutation)

		expect(response.status).toBe(400)
		expect(committed).toBe(true)
		expect(mutation.undo).toHaveBeenCalledExactlyOnceWith(attempt)
	})

	it.each([
		['a 5xx', async () => new Response('boom', { status: 503 })],
		[
			'a throw',
			async () => {
				throw new Error('database down')
			}
		]
	])('undoes the attempt before freeing the key after %s', async (_, run) => {
		const mutation = staged(vi.fn(run))

		await post(mutation).catch(() => undefined)

		expect(committed).toBe(false)
		expect(mutation.undo).toHaveBeenCalledExactlyOnceWith(attempt)
		expect(mutation.undo.mock.invocationCallOrder[0]).toBeLessThan(
			repository.releaseIdempotencyKey.mock.invocationCallOrder[0]
		)
	})

	it('undoes the attempt when prepare fails', async () => {
		const mutation = staged()
		const failure = new Error('storage down')
		mutation.prepare.mockRejectedValue(failure)

		await expect(post(mutation)).rejects.toBe(failure)
		expect(repository.inIdempotencyTransaction).not.toHaveBeenCalled()
		expect(mutation.undo).toHaveBeenCalledExactlyOnceWith(attempt)
		expect(repository.releaseIdempotencyKey).toHaveBeenCalledWith(claim)
	})

	it('undoes its own attempt when its claim was taken over, leaving the key to the new owner', async () => {
		repository.completeIdempotencyKey.mockResolvedValue(false)
		const mutation = staged()

		const response = await refusal(post(mutation))

		expect(response.status).toBe(409)
		expect(mutation.undo).toHaveBeenCalledExactlyOnceWith(attempt)
		expect(repository.releaseIdempotencyKey).not.toHaveBeenCalled()
	})

	it('reports a failed undo and still answers with the rollback', async () => {
		const mutation = staged(
			vi.fn(async () => new Response('boom', { status: 503 }))
		)
		const undoFailure = new Error('reclaim failed')
		mutation.undo.mockRejectedValue(undoFailure)

		const response = await post(mutation)

		expect(response.status).toBe(503)
		expect(reportServerError).toHaveBeenCalledWith(
			undoFailure,
			expect.anything()
		)
		expect(repository.releaseIdempotencyKey).toHaveBeenCalledWith(claim)
	})
})
