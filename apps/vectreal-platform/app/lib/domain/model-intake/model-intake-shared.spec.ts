import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import {
	addRetentionDays,
	buildIntakeShortUrl,
	buildIntakeUrl,
	cleanupMinutesBetween,
	intakeLetterDestination,
	parseIntakeStorePages,
	intakeLetterFormPath,
	intakePageLocale,
	isIntakeBodyAcceptable,
	mintIntakeLetterCode,
	MODEL_INTAKE_CODE_ALPHABET,
	MODEL_INTAKE_MAX_MESSAGE_LENGTH,
	MODEL_INTAKE_RETENTION_DAYS,
	normalizeIntakeLetterCode,
	parseIntakeSizeCm,
	resolveIntakeBatch,
	resolveIntakeLocale,
	intakeLetterAsksClientConsent,
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
	consentPhotos: true,
	asksClientConsent: false,
	consentClient: false
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
		['consentPhotos', { consentPhotos: false }],
		['consentClient', { asksClientConsent: true, consentClient: false }]
	] as const)('refuses a bad %s', (field, change) => {
		const result = validateIntakeFields({ ...valid, ...change })
		expect(result.ok).toBe(false)
		expect(result.ok ? {} : Object.keys(result.fieldErrors)).toEqual([field])
	})
})

describe('client consent', () => {
	it('is asked on agency letters only', () => {
		expect(intakeLetterAsksClientConsent({ audience: 'agency' })).toBe(true)
		expect(intakeLetterAsksClientConsent({ audience: 'brand' })).toBe(false)
		expect(intakeLetterAsksClientConsent(null)).toBe(false)
	})

	it('accepts an agency request that confirms it', () => {
		const result = validateIntakeFields({
			...valid,
			asksClientConsent: true,
			consentClient: true
		})
		expect(result.ok).toBe(true)
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

	it('reads an intake page language from its address alone', () => {
		expect(intakePageLocale('/agenturen', '')).toBe('de')
		expect(intakePageLocale('/agenturen', '?lang=en')).toBe('de')
		expect(intakePageLocale('/free-model', '?lang=de&c=ABCDEFGH')).toBe('de')
		expect(intakePageLocale('/free-model', '')).toBe('en')
		expect(intakePageLocale('/pricing', '?lang=de')).toBeNull()
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

describe('letter codes', () => {
	it('reads a printed code whatever its case and spacing', () => {
		expect(normalizeIntakeLetterCode(' k7q2m9ab ')).toBe('K7Q2M9AB')
	})

	it.each([
		null,
		'',
		'K7Q2M9A',
		'K7Q2M9ABC',
		'K7Q2M9A0',
		'K7Q2M9AO',
		'K7Q2M9A1',
		'K7Q2M9AI',
		'K7Q2M9AL',
		'K7Q-2M9A'
	])('refuses %s', (raw) => {
		expect(normalizeIntakeLetterCode(raw)).toBeNull()
	})

	it('mints codes it reads back, from the whole alphabet and nothing else', () => {
		const seen = new Set<string>()
		for (let i = 0; i < 2000; i++) {
			const code = mintIntakeLetterCode()
			expect(normalizeIntakeLetterCode(code)).toBe(code)
			for (const char of code) seen.add(char)
		}
		expect([...seen].sort().join('')).toBe(MODEL_INTAKE_CODE_ALPHABET)
	})

	it('puts nothing in an address but the code', () => {
		expect(buildIntakeShortUrl('https://vectreal.com', 'K7Q2M9AB')).toBe(
			'https://vectreal.com/c/K7Q2M9AB'
		)
		expect(intakeLetterFormPath('K7Q2M9AB', 'de')).toBe(
			'/free-model?c=K7Q2M9AB&lang=de'
		)
		expect(intakeLetterFormPath('K7Q2M9AB', 'en')).toBe(
			'/free-model?c=K7Q2M9AB'
		)
	})
})

describe('intakeLetterDestination', () => {
	const letter = {
		code: 'K7Q2M9AB',
		audience: 'brand',
		showcase: 'lamp',
		locale: 'de'
	} as const

	it('sends a code we never posted to the plain form', () => {
		expect(intakeLetterDestination(null, {})).toBe('/free-model')
	})

	it('sends a brand letter to the form while its showcase has no store page', () => {
		expect(intakeLetterDestination(letter, {})).toBe(
			'/free-model?c=K7Q2M9AB&lang=de'
		)
		expect(
			intakeLetterDestination(letter, {
				fire: 'https://store.example/products/fire'
			})
		).toBe('/free-model?c=K7Q2M9AB&lang=de')
		expect(
			intakeLetterDestination(
				{ ...letter, showcase: null },
				{ lamp: 'https://store.example/products/lamp' }
			)
		).toBe('/free-model?c=K7Q2M9AB&lang=de')
	})

	it("sends a brand letter to its showcase's store page, carrying the code", () => {
		expect(
			intakeLetterDestination(letter, {
				lamp: 'https://store.example/products/lamp?variant=1'
			})
		).toBe('https://store.example/products/lamp?variant=1&c=K7Q2M9AB')
	})

	it('sends an agency letter to the agency page, carrying the code, store page or not', () => {
		const agency = { ...letter, audience: 'agency' } as const
		expect(intakeLetterDestination(agency, {})).toBe('/agenturen?c=K7Q2M9AB')
		expect(
			intakeLetterDestination(agency, {
				lamp: 'https://store.example/products/lamp'
			})
		).toBe('/agenturen?c=K7Q2M9AB')
	})
})

describe('parseIntakeStorePages', () => {
	it('reads nothing as no pages', () => {
		expect(parseIntakeStorePages(undefined)).toEqual({ ok: true, pages: {} })
		expect(parseIntakeStorePages(' ')).toEqual({ ok: true, pages: {} })
	})

	it('reads one page per showcase', () => {
		expect(
			parseIntakeStorePages(
				' lamp = https://store.example/products/lamp?variant=1 ,coffee=https://store.example/products/coffee,'
			)
		).toEqual({
			ok: true,
			pages: {
				lamp: 'https://store.example/products/lamp?variant=1',
				coffee: 'https://store.example/products/coffee'
			}
		})
	})

	it.each([
		['sofa=https://store.example/products/sofa'],
		['https://store.example/products/lamp'],
		['lamp=http://store.example/products/lamp'],
		['lamp=store.example/products/lamp'],
		['lamp=https://store.example/products/lamp,fire=']
	])('refuses %s whole', (raw) => {
		expect(parseIntakeStorePages(raw).ok).toBe(false)
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

	// MDX takes no expression in running text, so the privacy policy keeps a literal held equal here.
	it('states the purge period in the privacy policy', () => {
		const policy = readFileSync(
			new URL('../../../routes/privacy-policy-page.mdx', import.meta.url),
			'utf8'
		)
		expect(policy).toContain(
			`deleted ${MODEL_INTAKE_RETENTION_DAYS} days after we deliver the model, or ${MODEL_INTAKE_RETENTION_DAYS} days after we receive them`
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
