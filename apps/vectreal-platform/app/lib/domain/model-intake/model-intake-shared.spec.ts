import { describe, expect, it } from 'vitest'

import {
	addRetentionDays,
	buildIntakeUrl,
	cleanupMinutesBetween,
	isIntakeBodyAcceptable,
	MODEL_INTAKE_MAX_MESSAGE_LENGTH,
	parseIntakeSizeCm,
	resolveIntakeBatch,
	resolveIntakeLocale,
	validateIntakeFields,
	type ModelIntakeTextInput
} from './model-intake-shared'

const valid: ModelIntakeTextInput = {
	name: '  Jane Doe ',
	email: ' Jane@Brand.DE ',
	company: 'Brand GmbH',
	productType: 'shoes',
	height: '12',
	width: '30,5',
	depth: '',
	message: '',
	consentFollowUp: true,
	consentPhotos: true
}

describe('validateIntakeFields', () => {
	it('accepts a complete request and normalizes it', () => {
		const result = validateIntakeFields(valid)
		expect(result).toEqual({
			ok: true,
			value: {
				name: 'Jane Doe',
				email: 'jane@brand.de',
				company: 'Brand GmbH',
				productType: 'shoes',
				size: { heightCm: 12, widthCm: 30.5, depthCm: null },
				message: ''
			}
		})
	})

	it.each([
		['name', { name: 'J' }],
		['name', { name: 'Win at https://spam.example' }],
		['name', { name: 'visit www.spam.example' }],
		['name', { name: '<b>Jane</b>' }],
		['email', { email: 'not-an-email' }],
		['company', { company: ' ' }],
		['productType', { productType: 'glassware' }],
		['size', { depth: '900' }],
		['message', { message: 'x'.repeat(MODEL_INTAKE_MAX_MESSAGE_LENGTH + 1) }],
		['consentFollowUp', { consentFollowUp: false }],
		['consentPhotos', { consentPhotos: false }]
	] as const)('refuses a bad %s', (field, change) => {
		const result = validateIntakeFields({ ...valid, ...change })
		expect(result.ok).toBe(false)
		expect(result.ok ? {} : Object.keys(result.fieldErrors)).toEqual([field])
	})
})

describe('parseIntakeSizeCm', () => {
	it('reads empty as no size, and a German decimal comma', () => {
		expect(parseIntakeSizeCm('  ')).toBeNull()
		expect(parseIntakeSizeCm('4,5')).toBe(4.5)
	})

	it.each(['0', '501', '-3', '12cm', '1e2'])('refuses %s', (raw) => {
		expect(parseIntakeSizeCm(raw)).toBe('invalid')
	})
})

describe('batches and locales', () => {
	it('records only listed batches and calls the rest direct', () => {
		expect(resolveIntakeBatch('2026-10-30-brands')).toBe('2026-10-30-brands')
		expect(resolveIntakeBatch('2026-10-30-brandz')).toBe('direct')
		expect(resolveIntakeBatch(null)).toBe('direct')
	})

	it('serves German only on request', () => {
		expect(resolveIntakeLocale('de')).toBe('de')
		expect(resolveIntakeLocale('fr')).toBe('en')
		expect(resolveIntakeLocale(null)).toBe('en')
	})

	it('builds the URL a QR code encodes', () => {
		expect(
			buildIntakeUrl('https://vectreal.com', '2026-10-30-agencies', 'de')
		).toBe('https://vectreal.com/free-model?b=2026-10-30-agencies&lang=de')
		expect(
			buildIntakeUrl('https://vectreal.com', '2026-10-30-brands', 'en')
		).toBe('https://vectreal.com/free-model?b=2026-10-30-brands')
	})
})

describe('cleanup and retention arithmetic', () => {
	it('counts whole minutes and never goes negative', () => {
		const start = new Date('2026-10-20T10:00:00Z')
		expect(cleanupMinutesBetween(start, new Date('2026-10-20T10:17:40Z'))).toBe(
			18
		)
		expect(cleanupMinutesBetween(start, new Date('2026-10-20T09:00:00Z'))).toBe(
			0
		)
	})

	it('keeps a request for 90 days', () => {
		expect(
			addRetentionDays(new Date('2026-10-20T00:00:00Z')).toISOString()
		).toBe('2027-01-18T00:00:00.000Z')
	})
})

describe('isIntakeBodyAcceptable', () => {
	it('reads a body that declares a length within three full photos', () => {
		expect(isIntakeBodyAcceptable(String(45 * 1024 * 1024))).toBe(true)
	})

	it.each([
		['no declared length', null],
		['a malformed length', '12abc'],
		['a body over the cap', String(47 * 1024 * 1024)]
	])('refuses %s', (_, header) => {
		expect(isIntakeBodyAcceptable(header)).toBe(false)
	})
})
