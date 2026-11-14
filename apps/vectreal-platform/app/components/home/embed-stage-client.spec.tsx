// @vitest-environment jsdom
/**
 * The camera in the product window is looked at, not handled: the screenshots
 * around it are pictures, and a camera that could be grabbed made each one
 * read as a 3D object.
 */
import { render } from '@testing-library/react'
import { createRef } from 'react'
import { expect, it, vi } from 'vitest'

import EmbedStageClient from './embed-stage-client'
import { createStageEngine } from './stage/stage-engine'

vi.mock('./stage/stage-engine', () => ({
	createStageEngine: vi.fn(() => ({
		show: () => new Promise(() => {}),
		fit: () => {},
		dispose: () => {}
	}))
}))

it('builds a stage the reader cannot turn', () => {
	// jsdom has no Web Animations, and the file is never needed: the engine is a stand-in.
	HTMLElement.prototype.getAnimations ??= () => []
	vi.stubGlobal('fetch', () => new Promise(() => {}))
	const frameRef = createRef<HTMLDivElement>()
	render(
		<div ref={frameRef}>
			<EmbedStageClient
				frameRef={frameRef}
				place={{ x: 0, y: 0, w: 1, h: 1 }}
				onLive={() => {}}
			/>
		</div>
	)
	expect(vi.mocked(createStageEngine)).toHaveBeenCalledWith(
		expect.anything(),
		expect.objectContaining({ turnable: false })
	)
})
