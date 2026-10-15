// @vitest-environment jsdom
/**
 * The card's size line says what a viewer downloads. When publish will still
 * encode the textures for the GPU, the size leaves that out, and no load time
 * can be read from it.
 */
import { render, screen } from '@testing-library/react'
import { createStore, Provider } from 'jotai'
import { describe, expect, it, vi } from 'vitest'

import { PublishCard } from './publish-card'
import { processAtom } from '../../../lib/stores/publisher-config-store'
import { optimizationRuntimeAtom } from '../../../lib/stores/scene-optimization-store'

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

/**
 * The status says whether the published file is what publishing would ship
 * now, which the server answers for the saved scene. A settings edit is not
 * an unpublished change: embeds read settings live once saved.
 */
describe('PublishCard status', () => {
	const renderPublished = (store: ReturnType<typeof createStore>) =>
		render(
			<Provider store={store}>
				<PublishCard
					isPublished
					onOpenPublishPanel={vi.fn()}
					onOpenOptimization={vi.fn()}
					disabled={false}
				/>
			</Provider>
		)
	const withStats = (publishedIsCurrent: boolean | null) => {
		const store = createStore()
		store.set(optimizationRuntimeAtom, (prev) => ({
			...prev,
			latestSceneStats: { currentSceneBytes: 995, publishedIsCurrent } as never
		}))
		return store
	}

	it('says Published while the published file is current', () => {
		renderPublished(withStats(true))

		expect(screen.getByText('Published')).toBeTruthy()
	})

	it('says so once a save leaves the published file behind', () => {
		renderPublished(withStats(false))

		expect(screen.getByText('Unpublished changes')).toBeTruthy()
	})

	it('says so for an unsaved pass', () => {
		const store = withStats(true)
		store.set(optimizationRuntimeAtom, (prev) => ({ ...prev, passRevision: 1 }))
		renderPublished(store)

		expect(screen.getByText('Unpublished changes')).toBeTruthy()
	})

	it('stays Published through an unsaved settings edit', () => {
		const store = withStats(true)
		store.set(processAtom, (prev) => ({ ...prev, hasUnsavedChanges: true }))
		renderPublished(store)

		expect(screen.getByText('Published')).toBeTruthy()
	})
})
