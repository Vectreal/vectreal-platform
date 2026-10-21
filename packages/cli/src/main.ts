import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import { stdin, stdout } from 'node:process'
import { createInterface } from 'node:readline/promises'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'

import { init } from './commands/init'
import { installMcp, serveMcp } from './commands/mcp'
import { login, logout, whoami } from './commands/session-commands'
import { type CliContext } from './context'
import {
	configDir,
	fallbackStore,
	fileStore,
	keychainStore
} from './credentials'
import {
	describeError,
	EXIT,
	isRefusedToken,
	NotSignedInError,
	UsageError
} from './errors'

export const HELP = `Usage: vectreal <command> [options]

Commands:
  login      Sign in through the browser and keep the session
  logout     End the session and forget it here
  whoami     Show who the session acts as
  init       Link this directory to a project (--project <id> or --create <name>)
  mcp        Serve the Vectreal tools to an agent over stdio (MCP)
  mcp install
             Register that server in this directory's .mcp.json

Options:
  --origin <url>   The Vectreal server (default: the last one signed in to,
                   else https://vectreal.com; or set VECTREAL_ORIGIN)
  --json           Print the result as JSON
  --no-browser     login: print the sign-in URL without opening a browser
  -h, --help       Show this help

Exit codes:
  0  done
  1  failed
  2  wrong usage
  3  not signed in (run vectreal login)
`

/** Runs one command and answers with its exit code. Never calls process.exit. */
export async function run(
	argv: string[],
	context: CliContext
): Promise<number> {
	let parsed
	try {
		parsed = parseArgs({
			args: argv,
			allowPositionals: true,
			options: {
				origin: { type: 'string' },
				json: { type: 'boolean', default: false },
				'no-browser': { type: 'boolean', default: false },
				project: { type: 'string' },
				create: { type: 'string' },
				help: { type: 'boolean', short: 'h', default: false }
			}
		})
	} catch (error) {
		context.err(`${(error as Error).message}\n\n${HELP}`)
		return EXIT.usage
	}

	const { values, positionals } = parsed
	const [command, ...extra] = positionals
	if (values.help) {
		context.out(HELP)
		return EXIT.ok
	}
	if (!command) {
		context.err(HELP)
		return EXIT.usage
	}
	const subcommand = command === 'mcp' ? extra.shift() : undefined
	if (extra.length > 0) {
		context.err(`Unexpected arguments: ${extra.join(' ')}\n\n${HELP}`)
		return EXIT.usage
	}

	const options = { origin: values.origin, json: values.json }
	try {
		switch (command) {
			case 'login':
				return await login(context, {
					...options,
					browser: !values['no-browser']
				})
			case 'logout':
				return await logout(context, options)
			case 'whoami':
				return await whoami(context, options)
			case 'init':
				return await init(context, {
					...options,
					project: values.project,
					create: values.create
				})
			case 'mcp':
				if (subcommand === undefined) return await serveMcp(context, options)
				if (subcommand === 'install') return installMcp(context, options)
				context.err(`Unknown mcp command: ${subcommand}\n\n${HELP}`)
				return EXIT.usage
			default:
				context.err(`Unknown command: ${command}\n\n${HELP}`)
				return EXIT.usage
		}
	} catch (error) {
		context.err(describeError(error))
		if (error instanceof UsageError || error instanceof NotSignedInError) {
			return error.exitCode
		}
		return isRefusedToken(error) ? EXIT.notSignedIn : EXIT.failure
	}
}

/**
 * The directory the user ran the command in. `pnpm vectreal` runs the script
 * from the workspace root and names the caller's directory in INIT_CWD.
 */
export function invocationDir(
	env: Record<string, string | undefined>,
	cwd: string
): string {
	return env.INIT_CWD || cwd
}

/**
 * How to open a URL in the default browser, with no shell in between. On
 * Windows that rules out `cmd /c start`: cmd reads every `&` in the query as
 * the end of a command, so the browser would get a URL without its client id,
 * state or challenge, and cmd would run the rest.
 */
export function browserCommand(
	platform: NodeJS.Platform,
	url: string
): [string, string[]] {
	if (platform === 'darwin') return ['open', [url]]
	if (platform === 'win32') {
		return ['rundll32', ['url.dll,FileProtocolHandler', url]]
	}
	return ['xdg-open', [url]]
}

function openBrowser(url: string) {
	const [command, args] = browserCommand(process.platform, url)
	// Best effort: the URL is printed either way.
	spawn(command, args, { stdio: 'ignore', detached: true })
		.on('error', () => undefined)
		.unref()
}

function processContext(): CliContext {
	const dir = configDir()
	return {
		env: process.env,
		cwd: invocationDir(process.env, process.cwd()),
		out: (text) => stdout.write(`${text}\n`),
		err: (text) => process.stderr.write(`${text}\n`),
		store: fallbackStore(keychainStore(), fileStore(dir), (message) =>
			process.stderr.write(`${message}\n`)
		),
		configDir: dir,
		fetch: globalThis.fetch,
		ask: stdin.isTTY
			? async (question) => {
					const prompt = createInterface({
						input: stdin,
						output: process.stderr
					})
					try {
						return await prompt.question(question)
					} finally {
						prompt.close()
					}
				}
			: undefined,
		openBrowser,
		launch: launchRecipe()
	}
}

/**
 * The command that started this process: node, its flags (tsx's loader when
 * run from the workspace) and the script. tsx hands its --tsconfig to the
 * process as a path relative to where it ran, so that is made absolute.
 */
function launchRecipe(): CliContext['launch'] {
	const tsconfig = process.env.TSX_TSCONFIG_PATH
	return {
		command: process.execPath,
		args: [...process.execArgv, process.argv[1] ?? ''],
		env: tsconfig ? { TSX_TSCONFIG_PATH: resolve(process.cwd(), tsconfig) } : {}
	}
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
	void run(process.argv.slice(2), processContext()).then((code) => {
		process.exitCode = code
	})
}
