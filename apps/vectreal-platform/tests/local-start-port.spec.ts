import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

/**
 * `nx start` serves the production build at the local stack's one app URL.
 *
 * Local Supabase knows the app only as `VECTREAL_URL`: it is the `site_url`
 * that OAuth consent, auth emails and social sign-in return to. A build served
 * anywhere else signs in through whatever runs there instead, which is how
 * `vectreal login --origin http://localhost:3000` landed on the dev server.
 */

const APP_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const startCommand = (): string =>
	JSON.parse(readFileSync(resolve(APP_DIR, 'project.json'), 'utf8')).targets
		.start.options.command

describe('the start target', () => {
	it('serves on the port VECTREAL_URL names', () => {
		const command = startCommand()
		expect(command).toContain('node server.mjs')
		const printPort = command.replace(
			'node server.mjs',
			'node -p process.env.PORT'
		)

		const port = execSync(printPort, {
			env: { ...process.env, VECTREAL_URL: 'http://localhost:4321' },
			encoding: 'utf8'
		}).trim()

		expect(port).toBe('4321')
	})
})
