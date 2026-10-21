import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it, vi } from 'vitest'

import { type CliContext } from '../context'
import { memoryStore } from '../test-support'
import { mcpOperationContext, routeConsoleToStderr } from './mcp'

describe('routeConsoleToStderr', () => {
	it('sends log, info and debug where error goes, keeping stdout for the protocol', () => {
		const error = vi.fn()
		const target = { log: vi.fn(), info: vi.fn(), debug: vi.fn(), error }

		routeConsoleToStderr(target as unknown as Console)
		target.log('Encoding slice')
		target.info('prune: Removed types')
		target.debug('x', 1)

		expect(error.mock.calls).toEqual([
			['Encoding slice'],
			['prune: Removed types'],
			['x', 1]
		])
	})
})

describe('mcpOperationContext', () => {
	const linkedDir = (origin: string) => {
		const dir = mkdtempSync(join(tmpdir(), 'vectreal-project-'))
		mkdirSync(join(dir, '.vectreal'))
		writeFileSync(
			join(dir, '.vectreal', 'project.json'),
			JSON.stringify({ origin, projectId: 'p-linked' })
		)
		return dir
	}
	const cliContext = (overrides: Partial<CliContext> = {}): CliContext => ({
		env: {},
		cwd: mkdtempSync(join(tmpdir(), 'vectreal-cwd-')),
		out: () => undefined,
		err: () => undefined,
		store: memoryStore(),
		configDir: mkdtempSync(join(tmpdir(), 'vectreal-config-')),
		fetch: globalThis.fetch,
		openBrowser: () => undefined,
		launch: { command: 'node', args: [], env: {} },
		...overrides
	})
	const exportForPublish = async (glb: Uint8Array) => glb

	it("reads the project Claude Code names over the working directory, on the link's origin", () => {
		const project = linkedDir('http://localhost:4200')
		const context = cliContext({ env: { CLAUDE_PROJECT_DIR: project } })

		const operations = mcpOperationContext(
			context,
			{ json: false },
			exportForPublish
		)

		expect(operations).toMatchObject({
			projectDir: project,
			origin: 'http://localhost:4200',
			defaultProjectId: 'p-linked'
		})
	})

	it('uses a named origin over the link, and then defaults to no project', () => {
		const context = cliContext({ cwd: linkedDir('http://localhost:4200') })

		const operations = mcpOperationContext(
			context,
			{ json: false, origin: 'https://vectreal.com' },
			exportForPublish
		)

		expect(operations.origin).toBe('https://vectreal.com')
		expect(operations.defaultProjectId).toBeUndefined()
	})

	it('has no default project in a directory nothing linked', () => {
		const operations = mcpOperationContext(
			cliContext(),
			{ json: false },
			exportForPublish
		)

		expect(operations.origin).toBe('https://vectreal.com')
		expect(operations.defaultProjectId).toBeUndefined()
	})
})
