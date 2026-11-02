// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { SCENE_SHADOW_NOTE_COPY, SceneShadowNote } from './scene-shadow-note'

describe('SceneShadowNote', () => {
	it('says the shadow is not stored, and how to store it', () => {
		render(<SceneShadowNote />)

		expect(screen.getByText(SCENE_SHADOW_NOTE_COPY)).toHaveClass(
			'text-muted-foreground',
			'text-xs'
		)
	})

	// The scene page has no render harness; this pins that it shows the note
	// only on the loader's word, right under the viewer's well.
	it('is shown by the scene page under the viewer, on the loader flag', () => {
		const page = readFileSync(
			resolve(__dirname, '../../../routes/dashboard-page/projects/scene.tsx'),
			'utf8'
		)

		expect(page).toMatch(
			/<\/section>\s*\{shadowNotStored \? <SceneShadowNote \/> : null\}/
		)
		// Asked of the manifest a visitor receives, not the saved row.
		expect(page).toMatch(
			/shadowNotStored = isPublishedShadowNotStored\(\{\s*isPublished: Boolean\(publishedMeta\),\s*manifest\s*\}\)/
		)
	})
})
