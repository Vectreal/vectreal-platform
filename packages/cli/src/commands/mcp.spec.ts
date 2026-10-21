import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it, vi } from 'vitest'

import { type CliContext } from '../context'
import { saveSession, writeConfig } from '../credentials'
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
	const codecs = {
		exportForPublish: async (glb: Uint8Array) => glb,
		readModel: async () => {
			throw new Error('not read here')
		}
	}

	const signedIn = (context: CliContext, origin: string) =>
		saveSession(context.store, origin, {
			clientId: 'cli-client',
			authorizationServer: `${origin}/auth/v1`,
			accessToken: 'a',
			refreshToken: 'r',
			expiresAt: Date.now() + 3_600_000
		})

	it("reads the project Claude Code names over the working directory, on the link's origin", () => {
		const project = linkedDir('http://localhost:4200')
		const context = cliContext({ env: { CLAUDE_PROJECT_DIR: project } })
		signedIn(context, 'http://localhost:4200')

		const operations = mcpOperationContext(context, { json: false }, codecs)

		expect(operations).toMatchObject({
			projectDir: project,
			origin: 'http://localhost:4200',
			defaultProjectId: 'p-linked'
		})
	})

	it('matches a link written with a trailing slash to its session', () => {
		const context = cliContext({ cwd: linkedDir('http://localhost:4200/') })
		signedIn(context, 'http://localhost:4200')

		const operations = mcpOperationContext(context, { json: false }, codecs)

		expect(operations.origin).toBe('http://localhost:4200')
		expect(operations.defaultProjectId).toBe('p-linked')
	})

	it('ignores a link to an origin with no session here', () => {
		const context = cliContext({ cwd: linkedDir('https://elsewhere.example') })

		const operations = mcpOperationContext(context, { json: false }, codecs)

		expect(operations.origin).toBe('https://vectreal.com')
		expect(operations.defaultProjectId).toBeUndefined()
	})

	it('ignores a link to an origin the CLI refuses, even with a session stored under it', () => {
		const context = cliContext({ cwd: linkedDir('http://evil.example') })
		signedIn(context, 'http://evil.example')

		const operations = mcpOperationContext(context, { json: false }, codecs)

		expect(operations.origin).toBe('https://vectreal.com')
		expect(operations.defaultProjectId).toBeUndefined()
	})

	const STAGING = 'https://staging.vectreal.test'
	it.each([
		['--origin', { origin: STAGING }, {}, STAGING],
		[
			'--origin naming the default',
			{ origin: 'https://vectreal.com' },
			{},
			'https://vectreal.com'
		],
		['VECTREAL_ORIGIN', {}, { VECTREAL_ORIGIN: STAGING }, STAGING],
		[
			'VECTREAL_ORIGIN under an empty --origin',
			{ origin: '' },
			{ VECTREAL_ORIGIN: STAGING },
			STAGING
		]
	])(
		'uses an origin named by %s over a trusted link, with no default project',
		(_source, named, env, expected) => {
			const context = cliContext({
				cwd: linkedDir('http://localhost:4200'),
				env
			})
			signedIn(context, 'http://localhost:4200')

			const operations = mcpOperationContext(
				context,
				{ json: false, ...named },
				codecs
			)

			expect(operations.origin).toBe(expected)
			expect(operations.defaultProjectId).toBeUndefined()
		}
	)

	it('uses a trusted link over the saved default origin', () => {
		const context = cliContext({ cwd: linkedDir('http://localhost:4200') })
		signedIn(context, 'http://localhost:4200')
		writeConfig(context.configDir, {
			defaultOrigin: 'https://saved.vectreal.test'
		})

		const operations = mcpOperationContext(context, { json: false }, codecs)

		expect(operations.origin).toBe('http://localhost:4200')
		expect(operations.defaultProjectId).toBe('p-linked')
	})

	it('falls back to the saved origin past an untrusted link, and takes no project from a link to that same origin', () => {
		const context = cliContext({
			cwd: linkedDir('https://saved.vectreal.test')
		})
		writeConfig(context.configDir, {
			defaultOrigin: 'https://saved.vectreal.test'
		})

		const operations = mcpOperationContext(context, { json: false }, codecs)

		expect(operations.origin).toBe('https://saved.vectreal.test')
		expect(operations.defaultProjectId).toBeUndefined()
	})

	it('has no default project in a directory nothing linked', () => {
		const operations = mcpOperationContext(
			cliContext(),
			{ json: false },
			codecs
		)

		expect(operations.origin).toBe('https://vectreal.com')
		expect(operations.defaultProjectId).toBeUndefined()
	})
})
