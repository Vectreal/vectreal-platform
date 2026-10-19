/**
 * Deletes free-model requests and their photos once they are due, or one
 * request on a brand's deletion request.
 *
 * Run via: pnpm nx run vectreal-platform:purge-model-intake -- [flags]
 *
 * Due means past `delete_after`: 90 days after delivery, or after receipt for
 * a request never delivered, and never for a booked pilot, whose agreement
 * governs instead. There is no scheduler in this deployment, so this runs by
 * hand, like `purge-orphaned-assets`.
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
	purgeExpiredIntakes
} from '../app/lib/domain/model-intake/model-intake-deletion.server'
import { selectExpiredIntakes } from '../app/lib/domain/model-intake/model-intake-repository.server'

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
	if (!apply) {
		const due = await selectExpiredIntakes(now)
		console.info('%d request(s) due. Re-run with --apply.', due.length)
		return
	}
	console.info('Deleted %d request(s).', await purgeExpiredIntakes(now))
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error instanceof Error ? error.message : error)
		process.exit(1)
	})
