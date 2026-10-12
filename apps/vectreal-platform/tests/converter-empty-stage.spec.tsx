// @vitest-environment jsdom
/**
 * The converter's empty stage sends a visitor holding a link to the viewer.
 *
 * Someone with a URL rather than a file has landed on the wrong tool, and the
 * converter pages are where search brings people in, so this line is also how
 * those pages lead to `/view`.
 */
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'

import { ConverterEmptyStage } from '../app/components/convert/converter-empty-stage'
import { convertPairBySlug } from '../app/lib/convert/convert-pairs'

describe('ConverterEmptyStage', () => {
	it('offers the viewer to a visitor with a link instead of a file', () => {
		const pair = convertPairBySlug('stl-to-glb')
		if (!pair) throw new Error('stl-to-glb is not a converter page')

		render(
			<MemoryRouter>
				<ConverterEmptyStage
					pair={pair}
					status="empty"
					progress={0}
					bundleCopy={null}
					isBundle={false}
					onChooseFile={() => {}}
					onChooseFolder={() => {}}
					onOpenSample={() => {}}
					sampleDownload={null}
				/>
			</MemoryRouter>
		)

		expect(
			screen.getByRole('link', { name: 'Open it in the viewer' })
		).toHaveAttribute('href', '/view')
	})
})
