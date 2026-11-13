/**
 * Deletes free-model requests and their photos once they are due, and the
 * letter codes and their scans past the same retention, or one request on a
 * brand's deletion request.
 *
 * Run via: pnpm nx run vectreal-platform:purge-model-intake -- [flags]
 *
 * Due means past `delete_after`: 90 days after delivery, or after receipt for
 * a request never delivered, and never for a booked pilot, whose agreement
 * governs instead. A letter is due 90 days after it was registered, once no
 * request kept past the run names it. `.github/workflows/cd-purge-model-intake.yaml`
 * runs this daily against production.
 *
 * SAFETY. Reporting is the default. Deleting needs `--apply` together with
 * `--confirm-host`, which must equal the host in `DATABASE_URL`.
 *
 *   --apply                   permit deletion; refused without --confirm-host
 *   --confirm-host=<host>     must equal the host in DATABASE_URL
 *   --reference=<VCTR-XXXX>   delete this one request, due or not
 *
 * Environment (no `envFile` on the nx target, on purpose - the operator states
 * which environment this is):
 *   DATABASE_URL, SUPABASE_URL, SUPABASE_SECRET_KEY
 */
import {
	deleteIntakeByReference,
	purgeExpiredIntakes,
	selectPurge
} from '../app/lib/domain/model-intake/model-intake-deletion.server'

function flag(name: string): string | undefined {
	const hit = process.argv.find((arg) => arg.startsWith(`--${name}=`))
	return hit?.slice(name.length + 3)
}

async function main() {
	const databaseUrl = process.env.DATABASE_URL
	if (!databaseUrl) throw new Error('DATABASE_URL is not set.')

	const host = new URL(databaseUrl).hostname
	const apply = process.argv.includes('--apply')
	const reference = flag('reference')
	console.info('Target: %s', host)

	if (apply && flag('confirm-host') !== host) {
		throw new Error(
			`--apply needs --confirm-host=${host}, so deleting is never an accident.`
		)
	}

	if (reference) {
		if (!apply) {
			console.info('Would delete %s. Re-run with --apply.', reference)
			return
		}
		const deleted = await deleteIntakeByReference(reference)
		console.info(deleted ? 'Deleted %s.' : 'No request %s.', reference)
		return
	}

	const now = new Date()
	const { requests, letters, orphans } = apply
		? await purgeExpiredIntakes(now)
		: await selectPurge(now)
	// Counts only: the scheduled run's log is public, and a letter code opens
	// a page that greets by the organization it was sent to.
	console.info(
		'%s %d request(s), %d letter(s) and their scans, and %d folder(s) left without a request.',
		apply ? 'Deleted' : 'Would delete',
		requests.length,
		letters.length,
		orphans.length
	)
	if (!apply) console.info('Re-run with --apply to delete.')
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error instanceof Error ? error.message : error)
		process.exit(1)
	})
