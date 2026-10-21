import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { StdioServerTransport } from '@modelcontextprotocol/server/stdio'

import {
	type CliContext,
	type GlobalOptions,
	report,
	signedInClient,
	targetOrigin
} from '../context'
import { loadSession } from '../credentials'
import { EXIT, UsageError } from '../errors'
import { readProjectLink } from './init'
import { createVectrealMcpServer } from '../mcp/register-operations'
import { OPERATIONS, type OperationContext } from '../operations'
import { normalizeOrigin } from '../origin'

/** The CLI's version, as the MCP server reports it. */
const VERSION = '0.0.0'

/** Where `vectreal mcp install` registers the server: Claude Code's project file. */
export const MCP_CONFIG_FILE = '.mcp.json'

/**
 * Sends `console.log`, `info` and `debug` to stderr. On stdio, stdout is the
 * protocol stream, and the Basis encoder and glTF-Transform log there during
 * a publish export; one stray line ends the session.
 */
export function routeConsoleToStderr(target: Console): void {
	const toStderr = (...args: unknown[]) => target.error(...args)
	target.log = toStderr
	target.info = toStderr
	target.debug = toStderr
}

/**
 * The origin a project link names, when it may be used: a valid origin the
 * user is signed in to. The file arrives with any repository the user clones,
 * so a link to a host they never signed in to would point the docs tools at
 * it, whatever it serves, and is ignored.
 */
function trustedLinkOrigin(
	context: CliContext,
	linked: string
): string | undefined {
	try {
		const origin = normalizeOrigin(linked)
		return loadSession(context.store, origin) ? origin : undefined
	} catch {
		return undefined
	}
}

/**
 * The project directory and the context the tools run in. Claude Code names
 * the project in CLAUDE_PROJECT_DIR rather than promising the working
 * directory. The linked project's origin is used unless one is named, and its
 * project is the default only on that origin.
 */
export function mcpOperationContext(
	context: CliContext,
	options: GlobalOptions,
	codecs: Pick<OperationContext, 'exportForPublish' | 'readModel'>
): OperationContext {
	const projectDir = context.env.CLAUDE_PROJECT_DIR || context.cwd
	const link = readProjectLink(projectDir)
	const named = options.origin || context.env.VECTREAL_ORIGIN
	const linked =
		!named && link ? trustedLinkOrigin(context, link.origin) : undefined
	const origin = linked ?? targetOrigin(context, options)
	return {
		origin,
		client: signedInClient(context, origin),
		defaultProjectId: linked ? link?.projectId : undefined,
		projectDir,
		fetch: context.fetch,
		readFile: async (path) => readFile(path),
		...codecs
	}
}

/** `vectreal mcp`: the tools over stdio, until the client closes the stream. */
export async function serveMcp(
	context: CliContext,
	options: GlobalOptions
): Promise<number> {
	routeConsoleToStderr(console)
	// Loaded after the reroute: Emscripten binds console.log when its module loads.
	const { exportForPublishInNode, readModelInNode } =
		await import('../operations/publish-export')
	const server = createVectrealMcpServer(
		OPERATIONS,
		mcpOperationContext(context, options, {
			exportForPublish: exportForPublishInNode,
			readModel: readModelInNode
		}),
		VERSION
	)
	const closed = new Promise<void>((resolve) => {
		server.server.onclose = resolve
	})
	await server.connect(new StdioServerTransport())
	await closed
	return EXIT.ok
}

/**
 * `vectreal mcp install`: registers the server in this directory's
 * `.mcp.json`, launched the way this CLI was, and keeps every other entry.
 */
export function installMcp(
	context: CliContext,
	options: GlobalOptions
): number {
	const file = join(context.cwd, MCP_CONFIG_FILE)
	let config: { mcpServers?: Record<string, unknown> } = {}
	if (existsSync(file)) {
		try {
			config = JSON.parse(readFileSync(file, 'utf8'))
		} catch {
			throw new UsageError(
				`${file} is not valid JSON. Fix or remove it, then run this again.`
			)
		}
	}

	const { command, args, env } = context.launch
	const entry = {
		type: 'stdio',
		command,
		args: [
			...args,
			'mcp',
			...(options.origin ? ['--origin', targetOrigin(context, options)] : [])
		],
		...(Object.keys(env).length > 0 ? { env } : {})
	}
	config.mcpServers = { ...config.mcpServers, vectreal: entry }
	writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`)

	report(
		context,
		options,
		{ file, server: entry },
		`Registered the vectreal MCP server in ${file}. Restart your agent to load it. The entry names paths on this machine, so keep the file out of version control or replace it once @vctrl/cli is on npm.`
	)
	return EXIT.ok
}
