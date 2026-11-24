// @vitest-environment jsdom
/**
 * Until the viewer's code arrives, its fallback fills the viewer's box and sits
 * in its middle.
 *
 * The Publisher hands over from its own loader to this fallback ("Preparing the
 * scene") and then to the viewer's. The fallback used to be returned bare, so
 * it took whatever layout its parent had: in the Publisher's stage, a flex row,
 * it shrank to its text and sat against the left edge for as long as the
 * viewer chunk took, then jumped back to the middle when the viewer drew its
 * own loader.
 */
import { render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'

import { ClientVectrealViewer } from '../app/components/viewer/client-vectreal-viewer'

// Never resolves, so the fallback is all there is to see.
vi.mock('@vctrl/viewer', () => new Promise(() => undefined))

it('places its fallback in the middle of the full viewer box', () => {
	render(
		<div className="flex">
			<ClientVectrealViewer
				className="rounded-2xl"
				fallback={<span>Preparing the scene</span>}
			/>
		</div>
	)

	const box = screen.getByText('Preparing the scene').parentElement
	expect(box?.className.split(' ')).toEqual(
		expect.arrayContaining([
			'flex',
			'h-full',
			'w-full',
			'items-center',
			'justify-center',
			'rounded-2xl'
		])
	)
})

it('draws nothing without a fallback', () => {
	const { container } = render(<ClientVectrealViewer />)
	expect(container).toBeEmptyDOMElement()
})
