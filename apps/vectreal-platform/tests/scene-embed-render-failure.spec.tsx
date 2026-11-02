// @vitest-environment jsdom
/**
 * A scene the viewer gave up drawing is reported, from the one component the
 * dashboard, `/preview` and `/embed` all render it through.
 *
 * The viewer shows its own failure state, so nothing on the page breaks and no
 * error boundary sees it: without this report a phone that cannot draw a scene
 * leaves no trace anywhere.
 */
import { act, render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import SceneEmbedViewer from '../app/components/scene-embed/scene-embed-viewer'

import type { VectrealViewerProps } from '@vctrl/viewer'

const captured: VectrealViewerProps[] = []
const reports: { error: unknown; source: unknown }[] = []

vi.mock('../app/components/viewer/client-vectreal-viewer', () => ({
	ClientVectrealViewer: (props: VectrealViewerProps) => {
		captured.push(props)
		return null
	}
}))

vi.mock('../app/lib/observability/use-error-report', () => ({
	useErrorReport: (error: unknown, source: unknown) => {
		if (error) reports.push({ error, source })
	}
}))

function renderViewer(onInteractionEvent = vi.fn()) {
	render(
		<SceneEmbedViewer
			file={null}
			theme="light"
			onInteractionEvent={onInteractionEvent}
		/>
	)
	const props = captured.at(-1)
	if (!props?.onInteractionEvent) throw new Error('no event handler reached')
	return { emit: props.onInteractionEvent, onInteractionEvent }
}

beforeEach(() => {
	captured.length = 0
	reports.length = 0
})

describe('a scene the viewer could not draw', () => {
	it('is reported as a fallback, with the reason and nothing else', () => {
		const { emit } = renderViewer()

		act(() => emit({ type: 'render_failed', reason: 'context_lost' }))

		expect(reports).toHaveLength(1)
		expect(reports[0].source).toBe('client-fallback')
		expect((reports[0].error as Error).message).toBe(
			'Viewer stopped drawing: context_lost'
		)
	})

	it('still reaches the host, as every other viewer event does', () => {
		const { emit, onInteractionEvent } = renderViewer()

		act(() => emit({ type: 'render_failed', reason: 'context_lost' }))

		expect(onInteractionEvent).toHaveBeenCalledWith({
			type: 'render_failed',
			reason: 'context_lost'
		})
	})

	it('hands the viewer the surface’s own failure state', () => {
		const renderFailure = () => null
		render(
			<SceneEmbedViewer
				file={null}
				theme="light"
				renderFailure={renderFailure}
			/>
		)

		expect(captured.at(-1)?.renderFailure).toBe(renderFailure)
	})

	it('reports nothing for a loss the browser recovered from', () => {
		const { emit } = renderViewer()

		act(() => {
			emit({ type: 'context_lost' })
			emit({ type: 'context_restored' })
		})

		expect(reports).toHaveLength(0)
	})
})
