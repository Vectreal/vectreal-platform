// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import {
	SCENE_RENDER_FAILURE_COPY,
	SceneRenderFailure
} from './scene-render-failure'

describe('SceneRenderFailure', () => {
	it('says why the scene is missing and offers both ways on', () => {
		const onRetry = vi.fn()
		const onOpenPublisher = vi.fn()
		render(
			<SceneRenderFailure onRetry={onRetry} onOpenPublisher={onOpenPublisher} />
		)

		expect(screen.getByRole('alert')).toHaveTextContent(
			SCENE_RENDER_FAILURE_COPY.description
		)
		expect(
			screen.getByRole('heading', {
				level: 2,
				name: SCENE_RENDER_FAILURE_COPY.title
			})
		).toBeInTheDocument()

		fireEvent.click(
			screen.getByRole('button', { name: SCENE_RENDER_FAILURE_COPY.retry })
		)
		expect(onRetry).toHaveBeenCalledOnce()
		fireEvent.click(
			screen.getByRole('button', {
				name: SCENE_RENDER_FAILURE_COPY.openPublisher
			})
		)
		expect(onOpenPublisher).toHaveBeenCalledOnce()
	})
})
