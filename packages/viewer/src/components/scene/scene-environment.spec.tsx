// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { Component, type ReactNode, Suspense } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import SceneEnvironment from './scene-environment'

import type { EnvironmentProps } from '@vctrl/core'

const roomMap = { name: 'room' }
let roomMapReady = true
let loadFiles: (files: unknown) => void = () => undefined

const { Environment } = vi.hoisted(() => ({
	Environment: vi.fn()
}))

vi.mock('@react-three/drei', () => ({
	Environment: (props: Record<string, unknown>) => {
		Environment(props)
		if (props.files) loadFiles(props.files)
		return null
	},
	useEnvironment: { preload: vi.fn() }
}))

vi.mock('./room-environment-map', () => ({
	useRoomEnvironmentMap: () => (roomMapReady ? roomMap : null)
}))

/** Stands in for the host page's error boundary, which must never see a load failure. */
class HostBoundary extends Component<
	{ children: ReactNode; onError: () => void },
	{ failed: boolean }
> {
	state = { failed: false }
	static getDerivedStateFromError() {
		return { failed: true }
	}
	componentDidCatch() {
		this.props.onError()
	}
	render() {
		return this.state.failed ? <p>crashed</p> : this.props.children
	}
}

const failingFiles = new Set<string>()

const renderEnvironment = (props: EnvironmentProps) => {
	const hostError = vi.fn()
	const view = (next: EnvironmentProps) => (
		<HostBoundary onError={hostError}>
			<Suspense fallback={<p>loading</p>}>
				<SceneEnvironment {...next} />
			</Suspense>
		</HostBoundary>
	)
	const result = render(view(props))
	return {
		...result,
		hostError,
		rerenderWith: (next: EnvironmentProps) => result.rerender(view(next))
	}
}

const lastEnvironmentProps = () =>
	Environment.mock.calls.at(-1)?.[0] as Record<string, unknown> | undefined

beforeEach(() => {
	vi.spyOn(console, 'error').mockImplementation(() => undefined)
	roomMapReady = true
	failingFiles.clear()
	loadFiles = (files) => {
		if (failingFiles.has(String(files))) {
			throw new Error(`Could not load ${String(files)}: Failed to fetch`)
		}
	}
})

afterEach(() => {
	Environment.mockClear()
	vi.restoreAllMocks()
})

describe('SceneEnvironment', () => {
	it("loads the scene's own map with its backdrop", () => {
		renderEnvironment({ files: '/env/studio.hdr', background: true })

		expect(lastEnvironmentProps()).toMatchObject({
			files: '/env/studio.hdr',
			background: true
		})
	})

	it('lights the scene from a local room when its map fails to download, without reaching the host', () => {
		failingFiles.add('/env/studio.hdr')

		const { hostError, queryByText } = renderEnvironment({
			files: '/env/studio.hdr',
			background: true,
			environmentIntensity: 0.7
		})

		expect(hostError).not.toHaveBeenCalled()
		expect(queryByText('crashed')).toBeNull()
		expect(lastEnvironmentProps()).toEqual({
			map: roomMap,
			environmentIntensity: 0.7,
			scene: undefined
		})
	})

	it('keeps the room for the map that failed rather than asking for it again', () => {
		failingFiles.add('/env/studio.hdr')
		const { rerenderWith } = renderEnvironment({ files: '/env/studio.hdr' })
		Environment.mockClear()

		rerenderWith({ files: '/env/studio.hdr', environmentIntensity: 2 })

		expect(Environment.mock.calls.map(([props]) => props.files)).toEqual([
			undefined
		])
	})

	it('tries a different map afresh after one has failed', () => {
		failingFiles.add('/env/studio.hdr')
		const { rerenderWith } = renderEnvironment({ files: '/env/studio.hdr' })

		rerenderWith({ files: '/env/sunset.hdr' })

		expect(lastEnvironmentProps()).toMatchObject({ files: '/env/sunset.hdr' })
	})

	it('holds the viewer content while the map downloads', () => {
		loadFiles = () => {
			throw new Promise(() => undefined)
		}

		const { getByText } = renderEnvironment({ files: '/env/studio.hdr' })

		expect(getByText('loading')).not.toBeNull()
	})

	it('draws nothing until the room has been built', () => {
		failingFiles.add('/env/studio.hdr')
		roomMapReady = false

		renderEnvironment({ files: '/env/studio.hdr' })

		expect(Environment.mock.calls.some(([props]) => props.map)).toBe(false)
	})
})
