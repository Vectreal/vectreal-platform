// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { act, render, screen } from '@testing-library/react'
import { Component, type ReactNode, Suspense } from 'react'
import {
	Mesh,
	MeshStandardMaterial,
	PerspectiveCamera,
	PlaneGeometry,
	Scene,
	Texture
} from 'three'
import { afterEach, describe, expect, it, vi } from 'vitest'

import EnvironmentPrewarm, { prewarmEnvironment } from './environment-prewarm'

const environment = new Texture()
const camera = new PerspectiveCamera()
const compile = vi.fn()
/** One renderer for every render, as R3F's store gives. */
const gl = { compile }

const useEnvironment = vi.hoisted(() =>
	Object.assign(vi.fn(), { clear: vi.fn() })
)

vi.mock('@react-three/drei', () => ({ useEnvironment }))

vi.mock('@react-three/fiber', () => ({
	useThree: (select: (state: unknown) => unknown) => select({ gl, camera })
}))

afterEach(() => {
	vi.restoreAllMocks()
	compile.mockReset()
	useEnvironment.mockReset()
	useEnvironment.clear.mockReset()
})

describe('prewarmEnvironment', () => {
	it('compiles a lit material while the environment is set, so three builds its PMREM', () => {
		const atCompile: Array<{ environment: unknown; material: unknown }> = []
		const gl = {
			compile: (scene: Scene) =>
				atCompile.push({
					environment: scene.environment,
					material: (scene.children[0] as Mesh).material
				})
		}

		prewarmEnvironment(gl as never, camera, environment)

		expect(atCompile).toHaveLength(1)
		expect(atCompile[0].environment).toBe(environment)
		expect(atCompile[0].material).toBeInstanceOf(MeshStandardMaterial)
	})

	it('releases its throwaway mesh once compiled, and never the environment', () => {
		const geometryDispose = vi.spyOn(PlaneGeometry.prototype, 'dispose')
		const materialDispose = vi.spyOn(MeshStandardMaterial.prototype, 'dispose')
		const environmentDispose = vi.spyOn(environment, 'dispose')
		let releasedBeforeCompile = true
		const gl = {
			compile: () => {
				releasedBeforeCompile =
					geometryDispose.mock.calls.length +
						materialDispose.mock.calls.length >
					0
			}
		}

		prewarmEnvironment(gl as never, camera, environment)

		expect(releasedBeforeCompile).toBe(false)
		expect(geometryDispose).toHaveBeenCalledOnce()
		expect(materialDispose).toHaveBeenCalledOnce()
		expect(environmentDispose).not.toHaveBeenCalled()
	})

	it('releases its throwaway mesh when the compile fails', () => {
		const geometryDispose = vi.spyOn(PlaneGeometry.prototype, 'dispose')
		const materialDispose = vi.spyOn(MeshStandardMaterial.prototype, 'dispose')
		const environmentDispose = vi.spyOn(environment, 'dispose')
		const gl = {
			compile: () => {
				throw new Error('context lost')
			}
		}

		expect(() => prewarmEnvironment(gl as never, camera, environment)).toThrow()
		expect(geometryDispose).toHaveBeenCalledOnce()
		expect(materialDispose).toHaveBeenCalledOnce()
		expect(environmentDispose).not.toHaveBeenCalled()
	})
})

/** Stands in for the page's error boundary, which must never see a prewarm. */
class PageBoundary extends Component<
	{ children: ReactNode; onCatch: () => void },
	{ failed: boolean }
> {
	state = { failed: false }
	static getDerivedStateFromError() {
		return { failed: true }
	}
	componentDidCatch() {
		this.props.onCatch()
	}
	render() {
		return this.state.failed ? null : this.props.children
	}
}

describe('EnvironmentPrewarm', () => {
	it('prewarms nothing until the viewer has chosen an environment', () => {
		render(<EnvironmentPrewarm files={null} />)

		expect(useEnvironment).not.toHaveBeenCalled()
		expect(compile).not.toHaveBeenCalled()
	})

	it('prewarms again every time the scene disposes the shared texture', () => {
		useEnvironment.mockReturnValue(environment)
		const { unmount } = render(<EnvironmentPrewarm files="studio.hdr" />)
		expect(compile).toHaveBeenCalledTimes(1)

		act(() => environment.dispose())
		act(() => environment.dispose())

		expect(compile).toHaveBeenCalledTimes(3)
		unmount()
	})

	it('keeps a failed load from the page, and prewarms the next environment', () => {
		vi.spyOn(console, 'error').mockImplementation(() => undefined)
		const pageCaught = vi.fn()
		useEnvironment.mockImplementation(({ files }: { files: string }) => {
			if (files === 'missing.hdr') throw new Error('404')
			return environment
		})
		const page = (files: string) => (
			<PageBoundary onCatch={pageCaught}>
				<EnvironmentPrewarm files={files} />
			</PageBoundary>
		)

		const { rerender, unmount } = render(page('missing.hdr'))
		expect(pageCaught).not.toHaveBeenCalled()
		expect(compile).not.toHaveBeenCalled()
		expect(useEnvironment.clear).toHaveBeenCalledWith({ files: 'missing.hdr' })

		rerender(page('studio.hdr'))
		expect(compile).toHaveBeenCalledOnce()
		unmount()
	})
})

describe('EnvironmentPrewarm, after a failed load', () => {
	const renderFailing = (files: string | string[]) => {
		vi.spyOn(console, 'error').mockImplementation(() => undefined)
		const pageCaught = vi.fn()
		useEnvironment.mockImplementation(() => {
			throw new Error('404')
		})
		render(
			<PageBoundary onCatch={pageCaught}>
				<EnvironmentPrewarm files={files} />
			</PageBoundary>
		)
		return pageCaught
	}

	it('forgets a failed cube map by its own list of files', () => {
		const cube = ['px.hdr', 'nx.hdr', 'py.hdr', 'ny.hdr', 'pz.hdr', 'nz.hdr']

		renderFailing(cube)

		expect(useEnvironment.clear).toHaveBeenCalledWith({ files: cube })
	})

	it('keeps the page up when the failure cannot be forgotten', () => {
		useEnvironment.clear.mockImplementation(() => {
			throw new Error('useEnvironment: Unrecognized file extension')
		})

		const pageCaught = renderFailing('/api/assets/123')

		expect(pageCaught).not.toHaveBeenCalled()
	})
})

describe('EnvironmentPrewarm, while its environment downloads', () => {
	it('keeps the viewer showing, and a download that then fails off the page', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => undefined)
		const pageCaught = vi.fn()
		let failDownload = (_error: Error) => undefined as void
		let failed: Error | null = null
		const download = new Promise<never>((_resolve, reject) => {
			failDownload = (error) => {
				failed = error
				reject(error)
			}
		}).catch(() => undefined)
		useEnvironment.mockImplementation(() => {
			throw failed ?? download
		})

		const { unmount } = render(
			<PageBoundary onCatch={pageCaught}>
				<Suspense fallback={<span data-testid="viewer-loader" />}>
					<EnvironmentPrewarm files="slow.hdr" />
				</Suspense>
			</PageBoundary>
		)
		expect(screen.queryByTestId('viewer-loader')).toBeNull()

		await act(async () => {
			failDownload(new Error('404'))
			await download
		})

		expect(screen.queryByTestId('viewer-loader')).toBeNull()
		expect(pageCaught).not.toHaveBeenCalled()
		expect(compile).not.toHaveBeenCalled()
		unmount()
	})
})

describe('the viewer', () => {
	const viewer = readFileSync(
		join(import.meta.dirname, '..', '..', 'vectreal-viewer.tsx'),
		'utf8'
	)

	it('prewarms the environment it was given, before there is content to light', () => {
		const prewarm = viewer.indexOf(
			'<EnvironmentPrewarm files={environmentFiles} />'
		)
		const contentGate = viewer.indexOf('{hasContent && (')
		expect(prewarm).toBeGreaterThan(-1)
		expect(contentGate).toBeGreaterThan(prewarm)
	})
})
