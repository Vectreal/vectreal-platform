// @vitest-environment jsdom
import { render } from '@testing-library/react'
import {
	Component,
	type ReactNode,
	Suspense,
	useEffect,
	useLayoutEffect
} from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import SceneEnvironment from './scene-environment'

import type { EnvironmentProps } from '@vctrl/core'

const { Environment, clearEnvironment, useRoomEnvironment, room } = vi.hoisted(
	() => ({
		Environment: vi.fn(),
		clearEnvironment: vi.fn(),
		useRoomEnvironment: vi.fn(),
		room: { lit: false }
	})
)

let loadFiles: (files: unknown) => void = () => undefined

vi.mock('@react-three/drei', () => ({
	Environment: (props: Record<string, unknown>) => {
		Environment(props)
		loadFiles(props.files)
		return null
	},
	useEnvironment: { preload: vi.fn(), clear: clearEnvironment }
}))

vi.mock('./room-environment', () => ({
	useRoomEnvironment: (...args: unknown[]) => {
		useRoomEnvironment(...args)
		useLayoutEffect(() => {
			room.lit = true
			return () => {
				room.lit = false
			}
		}, [])
	}
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

/** The viewer's shader warm-up: a passive effect beside the environment. */
const litAtWarmUp: boolean[] = []
const WarmUp = () => {
	useEffect(() => {
		litAtWarmUp.push(room.lit)
	}, [])
	return null
}

/** Files the network cannot serve, by the loader's own key shape. */
const failing = new Set<string>()
/** Failures drei's loader cache holds on to, until they are cleared. */
const cachedFailures = new Set<string>()
const cacheKey = (files: unknown) => JSON.stringify(files)

const renderEnvironment = (props: EnvironmentProps) => {
	const hostError = vi.fn()
	const view = (next: EnvironmentProps) => (
		<HostBoundary onError={hostError}>
			<Suspense fallback={<p>loading</p>}>
				<SceneEnvironment {...next} />
				<WarmUp />
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

const requestedFiles = () =>
	Environment.mock.calls.map(([props]) => String(props.files))

beforeEach(() => {
	vi.spyOn(console, 'error').mockImplementation(() => undefined)
	failing.clear()
	cachedFailures.clear()
	litAtWarmUp.length = 0
	loadFiles = (files) => {
		const key = cacheKey(files)
		if (failing.has(key)) cachedFailures.add(key)
		if (cachedFailures.has(key)) {
			throw new Error(`Could not load ${String(files)}: Failed to fetch`)
		}
	}
	clearEnvironment.mockImplementation(({ files }: { files: unknown }) =>
		cachedFailures.delete(cacheKey(files))
	)
})

afterEach(() => {
	Environment.mockClear()
	clearEnvironment.mockClear()
	useRoomEnvironment.mockClear()
	vi.restoreAllMocks()
})

describe('SceneEnvironment', () => {
	it("loads the scene's own map with its backdrop, and no room", () => {
		renderEnvironment({ files: '/env/studio.hdr', background: true })

		expect(Environment.mock.calls.at(-1)?.[0]).toMatchObject({
			files: '/env/studio.hdr',
			background: true
		})
		expect(useRoomEnvironment).not.toHaveBeenCalled()
	})

	it('lights the scene from a local room when its map fails, without reaching the host', () => {
		failing.add(cacheKey('/env/studio.hdr'))
		const target = { isScene: true }

		const { hostError, queryByText } = renderEnvironment({
			files: '/env/studio.hdr',
			background: true,
			environmentIntensity: 0.7,
			scene: target as unknown as EnvironmentProps['scene']
		})

		expect(hostError).not.toHaveBeenCalled()
		expect(queryByText('crashed')).toBeNull()
		expect(useRoomEnvironment).toHaveBeenLastCalledWith(0.7, target)
	})

	it('has the room in place before the shader warm-up compiles', () => {
		failing.add(cacheKey('/env/studio.hdr'))

		renderEnvironment({ files: '/env/studio.hdr' })

		expect(litAtWarmUp).toEqual([true])
	})

	it('forgets the failed download, so the map is fetched again next time', () => {
		failing.add(cacheKey('/env/studio.hdr'))

		renderEnvironment({ files: '/env/studio.hdr' })

		expect(clearEnvironment).toHaveBeenCalledWith({ files: '/env/studio.hdr' })
	})

	it('keeps the room while the failed map is on screen rather than asking again', () => {
		failing.add(cacheKey('/env/studio.hdr'))
		const { rerenderWith } = renderEnvironment({ files: '/env/studio.hdr' })
		Environment.mockClear()

		rerenderWith({
			files: '/env/studio.hdr',
			background: true,
			backgroundBlurriness: 0.1,
			backgroundIntensity: 3,
			environmentIntensity: 2
		})

		expect(Environment).not.toHaveBeenCalled()
		expect(useRoomEnvironment).toHaveBeenLastCalledWith(2, undefined)
	})

	it('stays on the room even when the failure cannot be forgotten', () => {
		failing.add(cacheKey('/env/studio.hdr'))
		clearEnvironment.mockImplementation(() => {
			throw new Error('useEnvironment: Unrecognized file extension')
		})

		const { hostError } = renderEnvironment({ files: '/env/studio.hdr' })

		expect(hostError).not.toHaveBeenCalled()
		expect(room.lit).toBe(true)
	})

	it('downloads a failed list of files again when it is shown again', () => {
		const cube = ['/env/px.hdr', '/env/nx.hdr']
		failing.add(cacheKey(cube))
		const { rerenderWith } = renderEnvironment({ files: cube })
		rerenderWith({ files: '/env/sunset.hdr' })
		failing.delete(cacheKey(cube))

		rerenderWith({ files: [...cube] })

		expect(Environment.mock.calls.at(-1)?.[0].files).toEqual(cube)
		expect(room.lit).toBe(false)
	})

	it('treats an equal list of files as the same map', () => {
		failing.add(cacheKey(['/env/px.hdr', '/env/nx.hdr']))
		const { rerenderWith } = renderEnvironment({
			files: ['/env/px.hdr', '/env/nx.hdr']
		})
		Environment.mockClear()

		rerenderWith({ files: ['/env/px.hdr', '/env/nx.hdr'] })

		expect(Environment).not.toHaveBeenCalled()
	})

	it('tries a different map, and lights from the room again if that fails too', () => {
		failing.add(cacheKey('/env/studio.hdr'))
		const { rerenderWith, hostError } = renderEnvironment({
			files: '/env/studio.hdr'
		})

		rerenderWith({ files: '/env/sunset.hdr' })
		expect(requestedFiles().at(-1)).toBe('/env/sunset.hdr')
		expect(room.lit).toBe(false)

		failing.add(cacheKey('/env/dusk.hdr'))
		rerenderWith({ files: '/env/dusk.hdr' })
		expect(room.lit).toBe(true)
		expect(hostError).not.toHaveBeenCalled()
	})

	it('downloads a failed map again when it is shown again', () => {
		failing.add(cacheKey('/env/studio.hdr'))
		const { rerenderWith } = renderEnvironment({ files: '/env/studio.hdr' })
		rerenderWith({ files: '/env/sunset.hdr' })
		failing.delete(cacheKey('/env/studio.hdr'))

		rerenderWith({ files: '/env/studio.hdr' })

		expect(requestedFiles().at(-1)).toBe('/env/studio.hdr')
		expect(room.lit).toBe(false)
	})

	it('holds the viewer content while the map downloads', () => {
		loadFiles = () => {
			throw new Promise(() => undefined)
		}

		const { getByText } = renderEnvironment({ files: '/env/studio.hdr' })

		expect(getByText('loading')).not.toBeNull()
	})
})
