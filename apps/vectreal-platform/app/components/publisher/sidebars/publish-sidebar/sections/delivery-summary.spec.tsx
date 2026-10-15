// @vitest-environment jsdom
/**
 * The Delivery heading pairs the size with its load time, unless the size
 * leaves out the GPU texture encoding that only publishing measures.
 */
import { TooltipProvider } from '@shared/components/ui/tooltip'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { DeliverySummary } from './delivery-summary'

const renderSummary = (sizeExcludesTextureEncoding: boolean) =>
	render(
		<TooltipProvider>
			<DeliverySummary
				sceneBytes={881_392}
				sizeReductionPercent={43}
				sizeDeltaLabel="642 KB smaller"
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
})
