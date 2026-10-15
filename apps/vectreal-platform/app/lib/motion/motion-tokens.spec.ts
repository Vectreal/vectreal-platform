// @vitest-environment jsdom
import { prefersReducedMotion } from './motion-tokens'

describe('prefersReducedMotion', () => {
	afterEach(() => {
		vi.unstubAllGlobals()
	})

	it.each([true, false])('reports the media query as %s', (matches) => {
		const matchMedia = vi.fn().mockReturnValue({ matches })
		vi.stubGlobal('matchMedia', matchMedia)

		expect(prefersReducedMotion()).toBe(matches)
		expect(matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)')
	})
})
