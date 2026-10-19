import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

/*
  The two route modules cannot be imported by a test (their import graph
  reaches the database client), so this reads their source and checks the
  guards are called where they must be. The guards themselves are specified
  in their own modules; this is the wiring.
*/

function source(relativePath: string): string {
	return readFileSync(new URL(relativePath, import.meta.url), 'utf8')
}

/** The text of one exported function, up to the next top-level export. */
function exported(text: string, name: string): string {
	const start = text.indexOf(`export async function ${name}(`)
	expect(start, `${name} is exported`).toBeGreaterThanOrEqual(0)
	const next = text.indexOf('\nexport ', start + 1)
	return text.slice(start, next === -1 ? undefined : next)
}

const FORM = '../../../routes/free-model-page.tsx'
const ADMIN = '../../../routes/dashboard-page/intake.tsx'

describe('/free-model action', () => {
	const action = exported(source(FORM), 'action')

	it('checks CSRF, then the bot challenge, before submitting', () => {
		const csrf = action.indexOf('ensureValidCsrfFormData(')
		const turnstile = action.indexOf('verifyTurnstileToken(')
		const submit = action.indexOf('submitModelIntake(')
		expect(csrf).toBeGreaterThan(0)
		expect(turnstile).toBeGreaterThan(csrf)
		expect(submit).toBeGreaterThan(turnstile)
	})

	it('refuses an oversized or undeclared body before parsing it', () => {
		const check = action.indexOf('isIntakeBodyAcceptable(')
		expect(check).toBeGreaterThan(0)
		expect(check).toBeLessThan(action.indexOf('request.formData()'))
	})
})

describe('/dashboard/intake', () => {
	const admin = source(ADMIN)

	it('gates the loader', () => {
		expect(exported(admin, 'loader')).toContain(
			'await requireIntakeAdmin(request)'
		)
	})

	it('gates the action before CSRF, so a refusal is the same 404', () => {
		const action = exported(admin, 'action')
		const gate = action.indexOf('await requireIntakeAdmin(request)')
		expect(gate).toBeGreaterThan(0)
		expect(gate).toBeLessThan(action.indexOf('ensureValidCsrfFormData('))
		expect(gate).toBeLessThan(action.indexOf("formData.get('intent')"))
	})
})
