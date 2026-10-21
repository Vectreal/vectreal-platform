import { createVectrealClient, type VectrealClient } from '@vctrl/sdk'

import { readConfig, type SecretStore } from './credentials'
import { resolveOrigin } from './origin'
import { createTokenSource } from './session'

/**
 * Everything a command touches outside itself, passed in so tests run a
 * command end to end against fakes.
 */
export interface CliContext {
	env: Record<string, string | undefined>
	cwd: string
	/** Results: text, or JSON with --json. Nothing else is written here. */
	out: (text: string) => void
	/** Progress, prompts and diagnostics. */
	err: (text: string) => void
	store: SecretStore
	configDir: string
	fetch: typeof fetch
	/** Asks a question on the terminal; undefined when there is no terminal. */
	ask?: (question: string) => Promise<string>
	openBrowser: (url: string) => void
	/** How to start this CLI again, as an agent's MCP config must. */
	launch: { command: string; args: string[]; env: Record<string, string> }
}

export interface GlobalOptions {
	origin?: string
	json: boolean
}

export function targetOrigin(context: CliContext, options: GlobalOptions) {
	return resolveOrigin({
		flag: options.origin,
		env: context.env.VECTREAL_ORIGIN,
		saved: readConfig(context.configDir).defaultOrigin
	})
}

/** A client that signs its requests with the stored session for `origin`. */
export function signedInClient(
	context: CliContext,
	origin: string
): VectrealClient {
	return createVectrealClient({
		baseUrl: origin,
		fetch: context.fetch,
		getAccessToken: createTokenSource({
			store: context.store,
			origin,
			fetch: context.fetch
		})
	})
}

/** Writes a result: the object as JSON with --json, else the text. */
export function report(
	context: CliContext,
	options: GlobalOptions,
	result: unknown,
	text: string
) {
	context.out(options.json ? JSON.stringify(result, null, 2) : text)
}
