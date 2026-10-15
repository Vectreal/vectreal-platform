// @vitest-environment jsdom
/**
 * The card's size line says what a viewer downloads. When publish will still
 * encode the textures for the GPU, the size leaves that out, and no load time
 * can be read from it.
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { PublishCard } from './publish-card'

const renderCard = (sizeExcludesTextureEncoding: boolean) =>
	render(
		<PublishCard
			sceneBytes={881_392}
			sizeExcludesTextureEncoding={sizeExcludesTextureEncoding}
			isPublished={false}
			onOpenPublishPanel={vi.fn()}
			onOpenOptimization={vi.fn()}
			disabled={false}
		/>
	)

describe('PublishCard size line', () => {
	it('gives the size and its load time', () => {
		renderCard(false)

		expect(screen.getByText(/^861 KB · ~0\.6s on 4G$/)).toBeTruthy()
	})

	it('names GPU textures instead of a load time when the size leaves them out', () => {
		renderCard(true)

		expect(screen.getByText('861 KB + GPU textures')).toBeTruthy()
		expect(screen.queryByText(/on 4G/)).toBeNull()
	})
})
