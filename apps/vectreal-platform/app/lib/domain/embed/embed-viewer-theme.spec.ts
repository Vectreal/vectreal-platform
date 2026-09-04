import { describe, expect, it } from 'vitest'

import { parseEmbedViewerTheme } from './embed-viewer-theme'

describe('parseEmbedViewerTheme', () => {
	it('follows the visitor’s own scheme when the host says nothing', () => {
		// The defect this replaced: every embed rendered dark chrome on every
		// host, light pages included, because the platform's viewer wrapper
		// defaulted to 'dark' and the embed surface never passed a theme.
		expect(parseEmbedViewerTheme(null)).toBe('system')
		expect(parseEmbedViewerTheme('')).toBe('system')
	})

	it('takes the host at its word', () => {
		expect(parseEmbedViewerTheme('light')).toBe('light')
		expect(parseEmbedViewerTheme('dark')).toBe('dark')
		expect(parseEmbedViewerTheme('system')).toBe('system')
	})

	it('tolerates the casing and padding a hand-written URL arrives with', () => {
		expect(parseEmbedViewerTheme(' Dark ')).toBe('dark')
	})

	it('keeps the scene rendering when the parameter is wrong', () => {
		// A third-party site wrote this URL by hand. A typo falls back rather
		// than throwing, so the model still shows.
		expect(parseEmbedViewerTheme('drak')).toBe('system')
		expect(parseEmbedViewerTheme('true')).toBe('system')
	})
})
