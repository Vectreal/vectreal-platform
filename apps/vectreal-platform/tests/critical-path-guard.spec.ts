/**
 * The rule that decides whether the critical path is guarded.
 *
 * `critical-path.spec.ts` asserts that every funnel step is exercised by a
 * spec, and this is what "exercised" means. It had no test of its own, which
 * matters more than it sounds: a matcher that answers yes too readily reports
 * the whole funnel as covered and fails silently forever.
 *
 * Written when colocating specs broke it. The matcher only understood a spec
 * that named its subject by full path, so moving a spec next to its module -
 * where it names it `./thing` - read as deleting the guard.
 */

import { describe, expect, it } from 'vitest'

import { isModuleGuarded, readSpecifiers } from './critical-path-guard'

const PROJECT = '/repo/apps/vectreal-platform'
const spec = (dir: string, source: string) => ({ dir, source })

describe('readSpecifiers', () => {
	it('separates what a spec imports from what it stubs out', () => {
		const { imported, mocked } = readSpecifiers(
			`import { a } from './thing'\nvi.mock('../other/thing', () => ({}))`
		)

		expect([...imported]).toEqual(['./thing'])
		expect([...mocked]).toEqual(['../other/thing'])
	})
})

describe('isModuleGuarded', () => {
	it('sees a spec sitting beside its module', () => {
		/*
		  The case colocation introduced. `./embed-access-policy` names nothing
		  until it is resolved against the directory the spec is in.
		*/
		expect(
			isModuleGuarded(
				'app/lib/domain/embed/embed-access-policy.ts',
				[
					spec(
						`${PROJECT}/app/lib/domain/embed`,
						`import { decide } from './embed-access-policy'`
					)
				],
				PROJECT
			)
		).toBe(true)
	})

	it('still sees a spec that names the module by path', () => {
		expect(
			isModuleGuarded(
				'app/lib/domain/embed/embed-access-policy.ts',
				[
					spec(
						`${PROJECT}/tests`,
						`import { decide } from '../app/lib/domain/embed/embed-access-policy'`
					)
				],
				PROJECT
			)
		).toBe(true)
	})

	it('does not count a module the spec only stubs out', () => {
		/*
		  A spec that mocks a module is testing its caller. It still imports the
		  module to configure the stub, so this cannot be done by ignoring the
		  mock - the two have to be read separately.
		*/
		expect(
			isModuleGuarded(
				'app/lib/domain/auth/api-key-repository.server.ts',
				[
					spec(
						`${PROJECT}/app/routes/dashboard-page`,
						`import { getAll } from '../../lib/domain/auth/api-key-repository.server'\n` +
							`vi.mock('../../lib/domain/auth/api-key-repository.server', () => ({}))`
					)
				],
				PROJECT
			)
		).toBe(false)
	})

	it('does not count a same-named module in another directory', () => {
		/*
		  The reason a relative specifier is resolved rather than matched on its
		  last segment: `embed-asset-policy` under `scene` and a hypothetical one
		  under `embed` are different modules, and a filename that merely
		  resembles the module's proves nothing about what runs.
		*/
		expect(
			isModuleGuarded(
				'app/lib/domain/scene/embed-asset-policy.ts',
				[
					spec(
						`${PROJECT}/app/lib/domain/embed`,
						`import { x } from './embed-asset-policy'`
					)
				],
				PROJECT
			)
		).toBe(false)
	})

	it('reports a module nothing imports', () => {
		expect(
			isModuleGuarded(
				'app/lib/domain/embed/embed-access-policy.ts',
				[spec(`${PROJECT}/tests`, `import { y } from '../app/lib/other'`)],
				PROJECT
			)
		).toBe(false)
	})
})
