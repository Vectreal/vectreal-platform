import { afterEach, describe, expect, it, vi } from 'vitest'

import {
	followIntakeShortLink,
	intakeLetterDeps,
	lookupIntakeLetter,
	resolveIntakeLetter,
	type IntakeLetterDeps
} from './model-intake-letter.server'
import { __resetRateLimitsForTest } from '../../http/rate-limit.server'

import type { ModelIntakeLetter } from './model-intake-repository.server'

const letter: ModelIntakeLetter = {
	code: 'K7Q2M9AB',
	organization: 'Brand GmbH',
	audience: 'brand',
	category: 'shoes',
	locale: 'de'
}
const scannedAt = new Date('2026-11-20T09:00:00Z')
const request = new Request('https://vectreal.com/c/k7q2m9ab')

function fakes(overrides: Partial<IntakeLetterDeps> = {}): IntakeLetterDeps {
	return {
		...intakeLetterDeps,
		now: () => scannedAt,
		isRateLimited: vi.fn(() => false),
		findIntakeLetter: vi.fn(async (code: string) =>
			code === letter.code ? letter : null
		),
		recordIntakeLetterScan: vi.fn(async () => {}),
		reportServerError: vi.fn(),
		...overrides
	}
}

describe('resolveIntakeLetter', () => {
	it('finds a posted letter by its code as typed', async () => {
		const deps = fakes()
		expect(await resolveIntakeLetter(request, ' k7q2m9ab', deps)).toEqual(
			letter
		)
		expect(deps.findIntakeLetter).toHaveBeenCalledWith('K7Q2M9AB')
	})

	it('looks up nothing for a malformed code, and spends no attempt on it', async () => {
		const deps = fakes()
		expect(await resolveIntakeLetter(request, 'Brand GmbH', deps)).toBeNull()
		expect(await resolveIntakeLetter(request, null, deps)).toBeNull()
		expect(deps.isRateLimited).not.toHaveBeenCalled()
		expect(deps.findIntakeLetter).not.toHaveBeenCalled()
	})

	it('stops answering an address that guesses codes', async () => {
		const deps = fakes({ isRateLimited: vi.fn(() => true) })
		expect(await resolveIntakeLetter(request, letter.code, deps)).toBeNull()
		expect(deps.findIntakeLetter).not.toHaveBeenCalled()
	})

	it('leaves the form working when the letter cannot be read', async () => {
		const failure = new Error('db down')
		const deps = fakes({ findIntakeLetter: vi.fn().mockRejectedValue(failure) })
		expect(await resolveIntakeLetter(request, letter.code, deps)).toBeNull()
		expect(deps.reportServerError).toHaveBeenCalledWith(failure, { request })
	})
})

describe('lookupIntakeLetter', () => {
	it("reads the code the form carried without spending the visitor's lookups", async () => {
		const deps = fakes({ isRateLimited: vi.fn(() => true) })
		expect(await lookupIntakeLetter(request, letter.code, deps)).toEqual(letter)
		expect(deps.isRateLimited).not.toHaveBeenCalled()
		expect(await lookupIntakeLetter(request, null, deps)).toBeNull()
	})
})

describe('the lookup limit', () => {
	afterEach(() => __resetRateLimitsForTest())

	it('lets a reader through and stops an address after thirty lookups', () => {
		const from = (ip: string) =>
			new Request('https://vectreal.com/c/k7q2m9ab', {
				headers: { 'cf-connecting-ip': ip }
			})
		for (let i = 0; i < 30; i++) {
			expect(intakeLetterDeps.isRateLimited(from('203.0.113.7'))).toBe(false)
		}
		expect(intakeLetterDeps.isRateLimited(from('203.0.113.7'))).toBe(true)
		expect(intakeLetterDeps.isRateLimited(from('203.0.113.8'))).toBe(false)
	})
})

describe('followIntakeShortLink', () => {
	it('counts the scan of a posted letter and forwards to its form', async () => {
		const deps = fakes()
		expect(await followIntakeShortLink(request, 'k7q2m9ab', deps)).toBe(
			'/free-model?c=K7Q2M9AB&lang=de'
		)
		expect(deps.recordIntakeLetterScan).toHaveBeenCalledWith(
			'K7Q2M9AB',
			scannedAt
		)
	})

	it('sends an unknown code to the plain form and counts nothing', async () => {
		const deps = fakes()
		expect(await followIntakeShortLink(request, 'ZZZZZZZZ', deps)).toBe(
			'/free-model'
		)
		expect(deps.recordIntakeLetterScan).not.toHaveBeenCalled()
	})

	it('still forwards when the scan cannot be stored', async () => {
		const failure = new Error('insert failed')
		const deps = fakes({
			recordIntakeLetterScan: vi.fn().mockRejectedValue(failure)
		})
		expect(await followIntakeShortLink(request, letter.code, deps)).toBe(
			'/free-model?c=K7Q2M9AB&lang=de'
		)
		expect(deps.reportServerError).toHaveBeenCalledWith(failure, { request })
	})
})
