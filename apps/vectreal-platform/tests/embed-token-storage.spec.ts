/**
 * The parts of embed-token storage that a check without a database can hold.
 *
 * The real proof that the two stored forms describe one secret lives in
 * `tests/integration/api-key-lifecycle.integration.spec.ts`, which reads the
 * ciphertext back out of Postgres and puts it through the same function
 * `/embed` calls. That suite does run on a pull request, since #753 added the
 * `integration` job to `ci-quality.yaml` - it did not when these assertions
 * were written, and the reason given here was that nothing executed it.
 *
 * They stay for a narrower reason that still holds. `vitest.config.ts` excludes
 * `tests/integration/**` from the unit run, so the suite most people execute
 * locally is green with both writes deleted and the column nullable enough that
 * typecheck is too. And the count below is a question about the *file* - are
 * there exactly two mint paths writing this - which no behavioral test asks: a
 * third mint path added without a write is a key that can never be shown, and
 * the integration suite would pass, because it exercises the two paths that
 * already exist.
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')

const REPOSITORY = read(
	'apps/vectreal-platform/app/lib/domain/auth/api-key-repository.server.ts'
)

describe('both mint paths store the value the panel needs', () => {
	/**
	 * The write, with the variable it must be derived from.
	 *
	 * `encryptEmbedToken(preview)` would satisfy a looser check, store four
	 * characters, and leave no other trace - not even an unused import.
	 */
	const WRITE = 'encryptedKey: encryptEmbedToken(plaintext)'

	/*
	  The count is the point, and it is why `publish-embed.mdx` can get away with
	  a single `present` claim on this literal: a claim only asks whether the
	  string occurs, so it stays green with one of the two call sites deleted -
	  and the page promises recoverability for both created and rotated keys.
	*/

	it('writes it on create and on rotate, and nowhere else silently', () => {
		const writes = REPOSITORY.split(WRITE).length - 1

		expect(
			writes,
			`expected \`${WRITE}\` on both the create and rotate paths; found ${writes}. A third mint path needs its own write, and a missing one means keys that can never be shown.`
		).toBe(2)
	})

	it('clears it on revoke', () => {
		/*
		  Revoking a leaked key has to stop the value being retrievable. The row
		  authorizes nothing afterwards either way, so this is about the action
		  meaning what its name says.
		*/
		expect(REPOSITORY).toContain('encryptedKey: null')
	})
})

describe('the deployment that has to configure it', () => {
	/*
	  The cipher declines to store rather than throwing, so a missing variable no
	  longer breaks key creation - it silently produces keys that can never be
	  shown, which is the problem this whole change exists to end. Nothing else
	  in the repo would notice.
	*/
	const ENV_VAR = 'EMBED_TOKEN_ENCRYPTION_KEY'

	it('is set by the script that provisions Fly secrets', () => {
		const script = read('terraform/scripts/setup-fly-secrets.sh')

		expect(script).toContain(`${ENV_VAR}="$emb_key"`)
		// Resolved per environment, so staging and production get their own.
		expect(script).toContain(`resolve ${ENV_VAR} "$ENV"`)
	})

	it('fails the run when it is missing, rather than deploying without it', () => {
		/*
		  `REQUIRED_PER_ENV` is the list that `exit 1`s, and it is checked once
		  per environment - so the bare name appearing there covers both. The
		  earlier `${emb_key:+...}` form skipped a missing value without comment,
		  so a forgotten key produced a *successful* deploy that minted keys
		  nobody could ever be shown, which is the failure this whole change
		  exists to end.
		*/
		const script = read('terraform/scripts/setup-fly-secrets.sh')

		const required = script.slice(
			script.indexOf('REQUIRED_PER_ENV=('),
			script.indexOf('MISSING=()')
		)
		expect(required).toContain(`"${ENV_VAR}"`)

		// Checked for staging and for prod, not just once overall.
		for (const env of ['STAGING', 'PROD']) {
			expect(script, env).toContain(
				`check_env_vars ${env} "\${REQUIRED_PER_ENV[@]}"`
			)
		}

		expect(script).toContain(`${ENV_VAR}="$emb_key"`)
		expect(script).not.toContain(`\${emb_key:+`)
	})

	it('is checked by verify mode too', () => {
		const script = read('terraform/scripts/setup-fly-secrets.sh')
		const checkList = script.slice(
			script.indexOf('check_env_secrets()'),
			script.indexOf('check_fly_secret "$app" "$field"')
		)

		expect(checkList).toContain(ENV_VAR)
	})

	/*
	  Verify used to `warn` and exit 0, so it could report this key missing and
	  still pass. It is a gate now, which is the only reason the check above is
	  worth anything in CI.
	*/
	it('makes verify mode a gate rather than a report', () => {
		const script = read('terraform/scripts/setup-fly-secrets.sh')
		const verifyMode = script.slice(
			script.indexOf('if [[ "$MODE" == "verify" ]]; then'),
			script.indexOf('# SYNC MODE')
		)

		expect(verifyMode).toContain('VERIFY_FAILED+=')
		expect(verifyMode).toMatch(/VERIFY_FAILED\[@\]}\s*-gt 0/)
		expect(verifyMode).toContain('exit 1')
	})

	it('is documented for both deployed environments', () => {
		const template = read('.env.development.example')

		for (const suffix of ['', '_STAGING', '_PROD']) {
			expect(template, `${ENV_VAR}${suffix}`).toContain(`${ENV_VAR}${suffix}=`)
		}
	})
})
