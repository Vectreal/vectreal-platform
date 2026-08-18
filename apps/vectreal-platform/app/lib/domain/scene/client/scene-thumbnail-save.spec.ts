import { describe, expect, it } from 'vitest'

import { planThumbnailForSave } from './scene-thumbnail-save'

const meta = (thumbnailUrl: string) => ({
	name: 'Scene',
	description: '',
	thumbnailUrl
})

const stored = '/api/scenes/s1/thumbnail/a1'
const captured = 'data:image/webp;base64,AAAA'

describe('planThumbnailForSave', () => {
	it('uploads the image captured in this session', () => {
		const plan = planThumbnailForSave({
			sceneMetaState: meta(captured),
			lastSavedSceneMeta: meta(''),
			defaultCameraChanged: false
		})

		expect(plan.capturedThumbnail).toBe(captured)
		expect(plan.needsCapture).toBe(false)
	})

	it('never leaves a data URL as the value to commit', () => {
		const plan = planThumbnailForSave({
			sceneMetaState: meta(captured),
			lastSavedSceneMeta: meta(captured),
			defaultCameraChanged: false
		})

		expect(plan.fallbackThumbnailUrl).toBe('')
	})

	it('falls back to the last stored URL when the upload fails', () => {
		const plan = planThumbnailForSave({
			sceneMetaState: meta(captured),
			lastSavedSceneMeta: meta(stored),
			defaultCameraChanged: false
		})

		expect(plan.fallbackThumbnailUrl).toBe(stored)
	})

	it('captures when the scene has no thumbnail at all', () => {
		const plan = planThumbnailForSave({
			sceneMetaState: meta(''),
			lastSavedSceneMeta: null,
			defaultCameraChanged: false
		})

		expect(plan.needsCapture).toBe(true)
	})

	it('recaptures when the opening frame moved', () => {
		const plan = planThumbnailForSave({
			sceneMetaState: meta(stored),
			lastSavedSceneMeta: meta(stored),
			defaultCameraChanged: true
		})

		expect(plan.needsCapture).toBe(true)
	})

	it('leaves a stored thumbnail alone when nothing changed', () => {
		const plan = planThumbnailForSave({
			sceneMetaState: meta(stored),
			lastSavedSceneMeta: meta(stored),
			defaultCameraChanged: false
		})

		expect(plan.needsCapture).toBe(false)
		expect(plan.capturedThumbnail).toBeNull()
		expect(plan.fallbackThumbnailUrl).toBe(stored)
	})
})
