import { SupersededError } from '@vctrl/core/model-optimizer'
import { describe, expect, it, vi } from 'vitest'

import { ingestIntoOptimizer } from './optimizer-ingest'

// Every ingest and fallback claims the optimizer, so none may run for a load
// that is no longer the newest.
describe('ingestIntoOptimizer', () => {
	it('ingests nothing for a retired load', async () => {
		const ingest = vi.fn(async () => undefined)
		await ingestIntoOptimizer(() => false, ingest)
		expect(ingest).not.toHaveBeenCalled()
	})

	it('runs no fallback for a load retired while it ingested', async () => {
		let current = true
		const fallback = vi.fn(async () => undefined)
		await ingestIntoOptimizer(
			() => current,
			async () => {
				current = false
				throw new Error('broken')
			},
			fallback
		)
		expect(fallback).not.toHaveBeenCalled()
	})

	it('runs no fallback once the optimizer refused the load', async () => {
		const fallback = vi.fn(async () => undefined)
		await ingestIntoOptimizer(
			() => true,
			async () => {
				throw new SupersededError()
			},
			fallback
		)
		expect(fallback).not.toHaveBeenCalled()
	})

	it('falls back for a current load whose ingest failed', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
		const fallback = vi.fn(async () => undefined)
		await ingestIntoOptimizer(
			() => true,
			async () => {
				throw new Error('broken')
			},
			fallback
		)
		expect(fallback).toHaveBeenCalledOnce()
		warn.mockRestore()
	})
})
