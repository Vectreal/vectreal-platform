// @vitest-environment jsdom
/**
 * A request to open the Camera tool on one camera is for the opening that
 * made it. If the author leaves before the Camera panel mounts (switches tool
 * inside its exit animation, closes the sidebar, enters preview), a later,
 * unrelated visit to the Camera tool must open on the camera list.
 */
import { render } from '@testing-library/react'
import { createStore, Provider } from 'jotai'
import { describe, expect, it } from 'vitest'

import { ToolSidebar } from './tool-sidebar'
import {
	cameraToolOpenRequestAtom,
	openCameraInCameraToolAtom,
	processAtom
} from '../../../lib/stores/publisher-config-store'

describe('ToolSidebar', () => {
	it('drops a Camera tool request once the Camera tool is not open', () => {
		const store = createStore()
		store.set(openCameraInCameraToolAtom, 'hotspot-camera-1')
		// The author closes the sidebar before the Camera panel mounted.
		store.set(processAtom, (prev) => ({ ...prev, showSidebar: false }))

		render(
			<Provider store={store}>
				<ToolSidebar />
			</Provider>
		)

		expect(store.get(cameraToolOpenRequestAtom)).toBeNull()
	})
})
