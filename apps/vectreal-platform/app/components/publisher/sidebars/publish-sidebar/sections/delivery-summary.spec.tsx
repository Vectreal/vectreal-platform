// @vitest-environment jsdom
/**
 * The Delivery heading pairs the size with its load time, unless the size
 * leaves out the GPU texture encoding that only publishing measures. The size
 * is the model and its environment map, what a visitor downloads.
 */
import { TooltipProvider } from '@shared/components/ui/tooltip'
import { formatFileSize } from '@shared/utils'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { DeliverySummary } from './delivery-summary'

const renderSummary = (
	sizeExcludesTextureEncoding: boolean,
	environmentBytes: null | number = null,
	sideAssetBytes = 0
) =>
	render(
		<TooltipProvider>
			<DeliverySummary
				modelBytes={881_392}
				downloadExtras={{ environmentBytes, sideAssetBytes }}
				sizeReductionPercent={43}
				originalBytes={1_523_000}
				sizeExcludesTextureEncoding={sizeExcludesTextureEncoding}
			/>
		</TooltipProvider>
	)

describe('DeliverySummary', () => {
	it('gives the load time for a size that is the whole file', () => {
		renderSummary(false)

		expect(screen.getByText(/on 4G/)).toBeTruthy()
		expect(screen.queryByText(/GPU textures/)).toBeNull()
	})

	it('names GPU textures instead when the size leaves them out', () => {
		renderSummary(true)

		expect(screen.getByText(/\+ GPU textures/)).toBeTruthy()
		expect(screen.queryByText(/on 4G/)).toBeNull()
	})

	it('counts the environment map into what a visitor downloads', () => {
		renderSummary(false, 73_838)

		expect(screen.getByText(formatFileSize(881_392 + 73_838))).toBeTruthy()
	})

	it('counts the files an embed fetches beside the model', () => {
		renderSummary(false, 73_838, 31_494)

		expect(
			screen.getByText(formatFileSize(881_392 + 73_838 + 31_494))
		).toBeTruthy()
	})

	it('compares the model with the original upload, not the download', () => {
		renderSummary(false, 73_838)

		expect(
			screen.getByText(`/ from ${formatFileSize(1_523_000)} original`)
		).toBeTruthy()
	})
})
