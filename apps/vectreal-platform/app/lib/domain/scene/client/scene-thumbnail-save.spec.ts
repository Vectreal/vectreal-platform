import { describe, expect, it } from 'vitest'

import { planThumbnailForSave } from './scene-thumbnail-save'

const meta = (thumbnailUrl: string) => ({
	name: 'Scene',
	description: '',
	thumbnailUrl
})

const storedId = 'a1'
const stored = `/api/scenes/s1/thumbnail/${storedId}`
const captured = 'data:image/webp;base64,AAAA'

describe('planThumbnailForSave', () => {
	it('uploads the image captured in this session', () => {
		const plan = planThumbnailForSave({
			sceneMetaState: meta(captured),
			lastSavedSceneMeta: meta(''),
			frameChanged: false,
			reusableThumbnailAssetId: storedId
		})

		expect(plan.capturedThumbnail).toBe(captured)
		expect(plan.needsCapture).toBe(false)
	})

	it('never leaves a data URL as the value to commit', () => {
		const plan = planThumbnailForSave({
			sceneMetaState: meta(captured),
			lastSavedSceneMeta: meta(captured),
			frameChanged: false,
			reusableThumbnailAssetId: storedId
		})

		expect(plan.fallbackThumbnailUrl).toBe('')
	})

	it('falls back to the last stored URL when the upload fails', () => {
		const plan = planThumbnailForSave({
			sceneMetaState: meta(captured),
			lastSavedSceneMeta: meta(stored),
			frameChanged: false,
			reusableThumbnailAssetId: storedId
		})

		expect(plan.fallbackThumbnailUrl).toBe(stored)
	})

	it('captures when the scene has no thumbnail at all', () => {
		const plan = planThumbnailForSave({
			sceneMetaState: meta(''),
			lastSavedSceneMeta: null,
			frameChanged: false,
			reusableThumbnailAssetId: storedId
		})

		expect(plan.needsCapture).toBe(true)
	})

	it('recaptures when the opening frame moved', () => {
		const plan = planThumbnailForSave({
			sceneMetaState: meta(stored),
			lastSavedSceneMeta: meta(stored),
			frameChanged: true,
			reusableThumbnailAssetId: storedId
		})

		expect(plan.needsCapture).toBe(true)
	})

	it('drops a pending capture for a fresh one when the frame changed', () => {
		const plan = planThumbnailForSave({
			sceneMetaState: meta(captured),
			lastSavedSceneMeta: meta(stored),
			frameChanged: true,
			reusableThumbnailAssetId: storedId
		})

		expect(plan.capturedThumbnail).toBeNull()
		expect(plan.needsCapture).toBe(true)
		expect(plan.fallbackThumbnailUrl).toBe(stored)
	})

	it('leaves a stored thumbnail alone when nothing changed', () => {
		const plan = planThumbnailForSave({
			sceneMetaState: meta(stored),
			lastSavedSceneMeta: meta(stored),
			frameChanged: false,
			reusableThumbnailAssetId: storedId
		})

		expect(plan.needsCapture).toBe(false)
		expect(plan.capturedThumbnail).toBeNull()
		expect(plan.fallbackThumbnailUrl).toBe(stored)
	})
	/*
	  A save into another project gets nothing back as reusable, and a stored
	  thumbnail lives in the old project. Relinked, it names an asset the new
	  project does not own, and the save refuses the whole commit.
	*/
	it('recaptures rather than relink a thumbnail the server does not list', () => {
		const plan = planThumbnailForSave({
			sceneMetaState: meta(stored),
			lastSavedSceneMeta: meta(stored),
			frameChanged: false,
			reusableThumbnailAssetId: undefined
		})

		expect(plan.needsCapture).toBe(true)
		expect(plan.fallbackThumbnailUrl).toBe('')
	})

	it('commits none, not the old URL, when that recapture fails to upload', () => {
		const plan = planThumbnailForSave({
			sceneMetaState: meta(captured),
			lastSavedSceneMeta: meta(stored),
			frameChanged: false,
			reusableThumbnailAssetId: 'some-other-thumbnail'
		})

		expect(plan.fallbackThumbnailUrl).toBe('')
	})
})
