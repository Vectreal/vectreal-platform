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

	/*
	  These used to pin the shape of the script - a local named `emb_key`, an
	  array named `REQUIRED_PER_ENV`, a `for field in` list - which is why they
	  broke when the four hand-written name lists became one manifest, even
	  though the rule they exist to protect never moved. They pin the manifest
	  now: membership in FLY_SECRETS_REQUIRED is the whole rule, and validation,
	  --verify and sync all read it, so one assertion covers all three.
	*/
	const script = () => read('terraform/scripts/setup-fly-secrets.sh')
	const manifestSection = (from: string, to: string) => {
		const source = script()
		return source.slice(source.indexOf(from), source.indexOf(to))
	}

	it('is set by the script that provisions Fly secrets', () => {
		expect(
			manifestSection('FLY_SECRETS_REQUIRED=(', 'FLY_SECRETS_OPTIONAL=(')
		).toContain(`"${ENV_VAR}"`)

		/*
		  A name in the manifest is only worth asserting if the *sync* reads it -
		  the old hand-written argument list is exactly how a name could sit in a
		  REQUIRED_ array and never reach `fly secrets set`.

		  Scoped to sync_fly_secrets rather than searched for in the whole file,
		  because --verify opens its loop with the same words plus a second
		  array. An unscoped `toContain` here passes on that line instead, and a
		  mutation replacing the sync loop's array with a literal survived it.
		*/
		const sync = manifestSection('sync_fly_secrets()', 'sync_supabase_hook()')

		expect(sync).toContain('for name in "${FLY_SECRETS_REQUIRED[@]}"; do')
		// Resolved per environment, so staging and production get their own.
		expect(sync).toContain('value="$(resolve "$name" "$ENV")"')
		expect(sync).toContain('args+=("${name}=${value}")')
	})

	it('fails the run when it is missing, rather than deploying without it', () => {
		/*
		  Optional entries are skipped when they resolve to nothing. For this key
		  that would be a *successful* deploy which mints keys nobody can ever be
		  shown - the failure this whole change exists to end - so the assertion
		  worth making is that it is not on that list.
		*/
		expect(
			manifestSection('FLY_SECRETS_OPTIONAL=(', 'FLY_SECRETS_SHARED=(')
		).not.toContain(`"${ENV_VAR}"`)

		// Checked for staging and for prod, not just once overall.
		for (const env of ['STAGING', 'PROD']) {
			expect(script(), env).toContain(
				`check_env_vars ${env} "\${FLY_SECRETS_REQUIRED[@]}"`
			)
		}
	})

	it('is checked by verify mode too', () => {
		/*
		  Required names go through `check_fly_secret`, which records a failure;
		  optional ones go through `warn_fly_secret`, which deliberately does
		  not. Membership decides which, so the pair of assertions below is what
		  makes this key's absence fail the gate rather than print a warning.
		*/
		const verify = manifestSection(
			'check_env_secrets()',
			'section "Supabase auth hook'
		)

		/*
		  The two have to be asserted as a pair. Two independent `toContain`s
		  both stay green when the loop bodies are swapped - required routed
		  through `warn_fly_secret`, optional through `check_fly_secret` - which
		  is precisely the state this test exists to catch, since it turns this
		  key's absence into a warning that passes the gate.
		*/
		expect(verify).toMatch(
			/for name in "\$\{FLY_SECRETS_REQUIRED\[@\]\}"[^\n]*\n\s*check_fly_secret "\$app" "\$name"/
		)
		expect(verify).toMatch(
			/for name in "\$\{FLY_SECRETS_OPTIONAL\[@\]\}"[^\n]*\n\s*warn_fly_secret "\$app" "\$name"/
		)
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
