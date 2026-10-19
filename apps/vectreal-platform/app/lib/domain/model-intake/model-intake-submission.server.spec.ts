import { describe, expect, it, vi } from 'vitest'

import {
	modelIntakeDeps,
	submitModelIntake,
	type ModelIntakeDeps
} from './model-intake-submission.server'

import type { IntakePhoto } from './model-intake-photos.server'

const photo: IntakePhoto = {
	bytes: Buffer.from('jpeg'),
	extension: 'jpg',
	contentType: 'image/jpeg'
}

function fakes(overrides: Partial<ModelIntakeDeps> = {}): ModelIntakeDeps {
	return {
		...modelIntakeDeps,
		now: () => new Date('2026-10-20T10:00:00Z'),
		newId: () => 'id-1',
		newReferenceCode: () => 'VCTR-TEST',
		isRateLimited: () => false,
		prepareIntakePhotos: vi.fn(async () => ({
			ok: true as const,
			photos: [photo, photo, photo]
		})),
		uploadIntakePhotos: vi.fn(async () => {}),
		signIntakePhotoUrls: vi.fn(async () => ['u1', 'u2', 'u3']),
		insertIntakeSubmission: vi.fn(async () => {}),
		deleteIntakeRow: vi.fn(async () => {}),
		deleteIntakePhotos: vi.fn(async () => {}),
		setIntakeEmailStatus: vi.fn(async () => {}),
		sendIntakeInternalNotification: vi.fn(async () => ({ ok: true })),
		sendIntakeConfirmation: vi.fn(async () => ({ ok: true })),
		encrypt: (value: string) => `enc(${value})`,
		...overrides
	}
}

function form(changes: Record<string, string | null> = {}): FormData {
	const entries: Record<string, string | null> = {
		name: 'Jane Doe',
		email: 'jane@brand.de',
		company: 'Brand GmbH',
		productType: 'other',
		height: '12',
		width: '',
		depth: '',
		message: 'Matte black',
		consentFollowUp: 'on',
		consentPhotos: 'on',
		website: '',
		...changes
	}
	const formData = new FormData()
	for (const [key, value] of Object.entries(entries)) {
		if (value !== null) formData.set(key, value)
	}
	for (let i = 0; i < 3; i++) {
		formData.append('photos', new File([`p${i}`], `p${i}.jpg`))
	}
	return formData
}

function submit(formData: FormData, deps: ModelIntakeDeps) {
	return submitModelIntake(
		{
			request: new Request('https://vectreal.com/free-model', {
				method: 'POST'
			}),
			formData,
			locale: 'de',
			batch: '2026-10-30-brands',
			intakePageUrl: 'https://vectreal.com/dashboard/intake'
		},
		deps
	)
}

describe('submitModelIntake', () => {
	it('stores an encrypted row with consent, batch and retention, then notifies both sides', async () => {
		const deps = fakes()
		const result = await submit(form(), deps)

		expect(result).toEqual({
			status: 200,
			body: {
				status: 'success',
				referenceCode: 'VCTR-TEST',
				confirmationFailed: false
			},
			outcome: 'submitted'
		})
		expect(deps.uploadIntakePhotos).toHaveBeenCalledWith('id-1', [
			photo,
			photo,
			photo
		])
		expect(deps.insertIntakeSubmission).toHaveBeenCalledWith(
			expect.objectContaining({
				id: 'id-1',
				referenceCode: 'VCTR-TEST',
				locale: 'de',
				batch: '2026-10-30-brands',
				productType: 'other',
				name: 'enc(Jane Doe)',
				email: 'enc(jane@brand.de)',
				company: 'enc(Brand GmbH)',
				message: 'enc(Matte black)',
				heightCm: 12,
				widthCm: null,
				photoPaths: ['id-1/1.jpg', 'id-1/2.jpg', 'id-1/3.jpg'],
				consentVersion: '2026-10-19',
				consentFollowUpAt: new Date('2026-10-20T10:00:00Z'),
				deleteAfter: new Date('2027-01-18T10:00:00Z')
			})
		)
		expect(deps.sendIntakeInternalNotification).toHaveBeenCalledWith(
			expect.objectContaining({
				needsReview: true,
				photoUrls: ['u1', 'u2', 'u3'],
				size: 'H 12 cm'
			})
		)
		expect(deps.sendIntakeConfirmation).toHaveBeenCalledWith({
			locale: 'de',
			email: 'jane@brand.de',
			displayName: 'Jane Doe',
			referenceCode: 'VCTR-TEST'
		})
		expect(deps.setIntakeEmailStatus).toHaveBeenCalledWith('id-1', 'sent')
	})

	it('answers a filled honeypot like a success and stores nothing', async () => {
		const deps = fakes()
		const result = await submit(form({ website: 'https://spam.example' }), deps)
		expect(result.outcome).toBe('honeypot')
		expect(result.body).toEqual({ status: 'success' })
		expect(deps.uploadIntakePhotos).not.toHaveBeenCalled()
		expect(deps.insertIntakeSubmission).not.toHaveBeenCalled()
	})

	it('refuses a missing consent and reports photo errors in the same answer', async () => {
		const deps = fakes({
			prepareIntakePhotos: vi.fn(async () => ({
				ok: false as const,
				fieldErrors: { photos: 'photoType' as const, photoIndex: 2 }
			}))
		})
		const result = await submit(form({ consentPhotos: null }), deps)
		expect(result.status).toBe(400)
		expect(result.body).toMatchObject({
			status: 'error',
			formError: 'validation',
			fieldErrors: {
				consentPhotos: 'consent',
				photos: 'photoType',
				photoIndex: 2
			}
		})
		expect(deps.uploadIntakePhotos).not.toHaveBeenCalled()
	})

	it('refuses a product type outside the accepted list', async () => {
		const deps = fakes()
		const result = await submit(form({ productType: 'glassware' }), deps)
		expect(result.body).toMatchObject({
			fieldErrors: { productType: 'productType' }
		})
		expect(deps.insertIntakeSubmission).not.toHaveBeenCalled()
	})

	it('stops at the rate limit before anything is stored', async () => {
		const deps = fakes({ isRateLimited: () => true })
		const result = await submit(form(), deps)
		expect(result.status).toBe(429)
		expect(deps.uploadIntakePhotos).not.toHaveBeenCalled()
	})

	it('uploads nothing when the row cannot be written', async () => {
		const deps = fakes({
			insertIntakeSubmission: vi.fn(async () => {
				throw new Error('db down')
			})
		})
		const result = await submit(form(), deps)
		expect(result).toMatchObject({ status: 500, outcome: 'db' })
		expect(deps.uploadIntakePhotos).not.toHaveBeenCalled()
		expect(deps.sendIntakeInternalNotification).not.toHaveBeenCalled()
	})

	it('writes the row before the photos and removes it when the upload fails', async () => {
		const order: string[] = []
		const deps = fakes({
			insertIntakeSubmission: vi.fn(async () => {
				order.push('insert')
			}),
			uploadIntakePhotos: vi.fn(async () => {
				order.push('upload')
				throw new Error('storage down')
			})
		})
		const result = await submit(form(), deps)
		expect(order).toEqual(['insert', 'upload'])
		expect(result).toMatchObject({ status: 500, outcome: 'storage' })
		expect(deps.deleteIntakePhotos).toHaveBeenCalledWith([
			'id-1/1.jpg',
			'id-1/2.jpg',
			'id-1/3.jpg'
		])
		expect(deps.deleteIntakeRow).toHaveBeenCalledWith('id-1')
		expect(deps.sendIntakeInternalNotification).not.toHaveBeenCalled()
	})

	it('keeps the row for the purge when the photos cannot be removed', async () => {
		const deps = fakes({
			uploadIntakePhotos: vi.fn(async () => {
				throw new Error('storage down')
			}),
			deleteIntakePhotos: vi.fn(async () => {
				throw new Error('still down')
			})
		})
		const result = await submit(form(), deps)
		expect(result).toMatchObject({ status: 500, outcome: 'storage' })
		expect(deps.deleteIntakeRow).not.toHaveBeenCalled()
	})

	it('answers success when only the email-status bookkeeping fails', async () => {
		const deps = fakes({
			setIntakeEmailStatus: vi.fn(async () => {
				throw new Error('db blip')
			})
		})
		const result = await submit(form(), deps)
		expect(result.body).toMatchObject({
			status: 'success',
			referenceCode: 'VCTR-TEST'
		})
	})

	it('still confirms a stored request when an email fails, and records which', async () => {
		const deps = fakes({
			sendIntakeInternalNotification: vi.fn(async () => ({ ok: false })),
			sendIntakeConfirmation: vi.fn(async () => ({ ok: false }))
		})
		const result = await submit(form(), deps)
		expect(result.body).toEqual({
			status: 'success',
			referenceCode: 'VCTR-TEST',
			confirmationFailed: true
		})
		expect(deps.setIntakeEmailStatus).toHaveBeenCalledWith('id-1', 'failed')
	})

	it('records a partial send when only the confirmation fails', async () => {
		const deps = fakes({
			sendIntakeConfirmation: vi.fn(async () => ({ ok: false }))
		})
		await submit(form(), deps)
		expect(deps.setIntakeEmailStatus).toHaveBeenCalledWith('id-1', 'partial')
	})
})
