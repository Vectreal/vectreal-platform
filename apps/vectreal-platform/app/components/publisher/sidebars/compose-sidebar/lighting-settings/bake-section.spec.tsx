// @vitest-environment jsdom
/**
 * What the studio finish says when it did not apply: the words for its
 * reason, never the error behind it.
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { BakeSection } from './bake-section'
import {
	BAKE_RECOVERY_NOTES,
	BAKE_SKIP_REASONS,
	STUDIO_FINISH_FAILURES
} from '../../../../../lib/domain/scene/client/studio-finish-reasons'

import type { BakePreview } from '../../../../../lib/stores/publisher-config-store'

const SOURCE = { document: null, passRevision: 0, bakes: '' }

const renderSection = (preview: BakePreview) =>
	render(
		<BakeSection
			preview={preview}
			canBake
			isOptimizing={false}
			isAnimated={false}
			onBake={() => {}}
			onShownChange={() => {}}
		/>
	)

describe('BakeSection', () => {
	it('says why the finish failed in words the author can act on', () => {
		renderSection({
			status: 'failed',
			source: SOURCE,
			shown: true,
			failure: { reason: 'no-webgl', detail: 'Error creating WebGL context.' }
		})

		expect(screen.getByRole('alert').textContent).toBe(
			STUDIO_FINISH_FAILURES['no-webgl'].message
		)
		expect(screen.queryByText(/Error creating WebGL context/)).toBeNull()
	})

	it('says why one bake failed while the other shows', () => {
		renderSection({
			status: 'ready',
			source: SOURCE,
			shown: true,
			reports: {
				occlusion: { baked: ['Body'], skipped: [] },
				lights: { failed: 'gpu-reset', detail: 'GL_CONTEXT_LOST_WEBGL' }
			}
		})

		expect(
			screen.getByText(STUDIO_FINISH_FAILURES['gpu-reset'].message, {
				exact: false
			})
		).toBeTruthy()
		expect(screen.queryByText(/GL_CONTEXT_LOST_WEBGL/)).toBeNull()
	})

	it('says a bake was drawn at lower detail, and nothing for a plain retry', () => {
		const { unmount } = renderSection({
			status: 'ready',
			source: SOURCE,
			shown: true,
			reports: {
				occlusion: { baked: ['Body'], skipped: [], recovered: 'lower-detail' }
			}
		})
		expect(screen.getByText(BAKE_RECOVERY_NOTES['lower-detail'])).toBeTruthy()
		unmount()

		renderSection({
			status: 'ready',
			source: SOURCE,
			shown: true,
			reports: {
				occlusion: { baked: ['Body'], skipped: [], recovered: 'retried' }
			}
		})
		expect(screen.queryByText(BAKE_RECOVERY_NOTES['lower-detail'])).toBeNull()
	})

	it('names each material it skipped with what would let it take the finish', () => {
		renderSection({
			status: 'ready',
			source: SOURCE,
			shown: true,
			reports: {
				occlusion: {
					baked: ['Body'],
					skipped: [{ material: 'Logo', reason: 'tiling-uvs' }]
				}
			}
		})

		expect(screen.getByRole('listitem').textContent).toBe(
			`Logo: ${BAKE_SKIP_REASONS['tiling-uvs']}`
		)
	})
})
