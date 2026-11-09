import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

const N8AOPostPass = class {}

describe('loadN8AOPostPass', () => {
	afterEach(() => {
		vi.doUnmock('n8ao')
		vi.resetModules()
	})

	it('resolves to the pass class and fetches it once', async () => {
		const factory = vi.fn(() => ({ N8AOPostPass }))
		vi.doMock('n8ao', factory)
		const { loadN8AOPostPass } = await import('./n8ao')

		const [first, second] = await Promise.all([
			loadN8AOPostPass(),
			loadN8AOPostPass()
		])
		expect(first).toBe(N8AOPostPass)
		expect(second).toBe(N8AOPostPass)
		expect(await loadN8AOPostPass()).toBe(N8AOPostPass)
		expect(factory).toHaveBeenCalledTimes(1)
	})

	it('tries again after a failed fetch', async () => {
		vi.doMock('n8ao', () => {
			throw new Error('chunk failed')
		})
		const { loadN8AOPostPass } = await import('./n8ao')
		await expect(loadN8AOPostPass()).rejects.toThrow()

		vi.doMock('n8ao', () => ({ N8AOPostPass }))
		expect(await loadN8AOPostPass()).toBe(N8AOPostPass)
	})
})

/*
  The point of the loader is that n8ao stays out of every chunk a scene
  without live AO downloads. One static import anywhere in the viewer would
  put it back in the viewer's own chunk.
*/
describe('n8ao is never imported statically', () => {
	const source = join(import.meta.dirname, '..', '..')
	const files = (dir: string): string[] =>
		readdirSync(dir).flatMap((name) => {
			const path = join(dir, name)
			if (statSync(path).isDirectory()) return files(path)
			return /\.tsx?$/.test(name) && !/\.spec\.tsx?$/.test(name) ? [path] : []
		})

	it('in any viewer source file', () => {
		const offenders = files(source).filter((file) =>
			/^\s*(?:import|export)\s+(?:[^;]*?\bfrom\s+)?['"]n8ao['"]/m.test(
				readFileSync(file, 'utf8')
			)
		)
		expect(offenders).toEqual([])
	})
})
