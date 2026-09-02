/**
 * Reports, and on request deletes, assets that nothing can reach.
 *
 * Run via: pnpm nx run vectreal-platform:purge-orphaned-assets
 *
 * This is a DML purge, not a schema change, so it is a script rather than a
 * migration: `drizzle-generate` output is derived from the schema and must stay
 * that way.
 *
 * Three disagreements accumulate between `assets` and the bucket, and they are
 * not the same problem:
 *
 *   1. Rows nothing references. Deletable.
 *   2. Objects no row names. Deletable, and findable only by listing the
 *      bucket: once the row is gone so is `file_path`, so no query can reach
 *      them. This is what a project delete used to leave behind.
 *   3. Rows something still references whose object is missing. Reported and
 *      never deleted - a live scene points at these, and the row is the last
 *      record of what the file was.
 *
 * SAFETY. Reporting is the default. Deleting needs `--apply` together with
 * `--confirm-host`, which must match the host in `DATABASE_URL`, so pointing at
 * the wrong environment has to be deliberate rather than a shell-history
 * accident. Nothing newer than `--older-than` is ever a candidate, because an
 * upload in flight is legitimately unreferenced for the length of its save.
 *
 *   --apply                 permit deletion; refused without --confirm-host
 *   --confirm-host=<host>   must equal the host in DATABASE_URL
 *   --older-than=<hours>    minimum age of a candidate (default 24, minimum 1)
 *   --max-deletes=<n>       abort before deleting more than this (default 500)
 *   --out=<path>            write the full candidate manifest as JSON
 *
 * Flags take the `--name=value` form; a space-separated value is not read, and
 * falls back to the default rather than to something more permissive.
 *
 * Environment (no `envFile` on the nx target, on purpose - the operator states
 * which environment this is):
 *   DATABASE_URL, SUPABASE_URL, SUPABASE_SECRET_KEY
 */
import { writeFile } from 'node:fs/promises'

import { sql } from 'drizzle-orm'

import { getDbClient } from '../app/db/client'
import { assets } from '../app/db/schema'
import {
	deleteAssets,
	deleteStorageObjects,
	selectUnreferencedAssetIds
} from '../app/lib/domain/asset/asset-storage.server'
import {
	partitionOrphans,
	type OrphanAssetRow
} from '../app/lib/domain/asset/orphan-partition'

const STORAGE_BUCKET = 'assets'
const REFERENCE_CHUNK = 500

interface Options {
	apply: boolean
	confirmHost: string | null
	olderThanHours: number
	maxDeletes: number
	outPath: string | null
}

function parseArgs(argv: string[]): Options {
	const get = (name: string) => {
		const hit = argv.find((arg) => arg.startsWith(`--${name}=`))
		return hit ? hit.slice(name.length + 3) : null
	}

	// Parsed strictly, because both of these bound a destructive run and
	// `Number('all')` is `NaN`, which every `>` comparison answers `false` to.
	// A typo would have silently removed the cap it was trying to raise.
	const positiveNumber = (name: string, fallback: number, min: number) => {
		const raw = get(name)
		if (raw === null) return fallback

		// A blank value is rejected rather than coerced. `Number('')` is 0, so
		// `--older-than=$RETENTION_HOURS` with the variable unset would otherwise
		// parse as zero and silently switch off the protection that keeps
		// in-flight uploads out of a destructive run.
		if (raw.trim() === '') {
			throw new Error(`--${name} was given no value.`)
		}

		const value = Number(raw)
		if (!Number.isFinite(value) || value < min) {
			throw new Error(
				`--${name} must be a number of at least ${min} (got "${raw}").`
			)
		}
		return value
	}

	return {
		apply: argv.includes('--apply'),
		confirmHost: get('confirm-host'),
		// At least an hour: the point of the flag is to exclude uploads that are
		// still in flight, and zero would exclude nothing.
		olderThanHours: positiveNumber('older-than', 24, 1),
		maxDeletes: positiveNumber('max-deletes', 500, 0),
		outPath: get('out')
	}
}

function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`
	const units = ['KB', 'MB', 'GB', 'TB']
	let value = bytes / 1024
	let unit = 0
	while (value >= 1024 && unit < units.length - 1) {
		value /= 1024
		unit += 1
	}
	return `${value.toFixed(1)} ${units[unit]}`
}

/**
 * Every object key in the bucket.
 *
 * Supabase keeps storage metadata in the same Postgres that `DATABASE_URL`
 * points at, so one anti-join answers this exactly. The application role may
 * not be able to read the `storage` schema, in which case the caller is told
 * rather than handed a silently short list - an empty read here would look
 * identical to "the bucket is clean" and would make every row look dangling.
 */
async function readStorageObjectNames(
	db: ReturnType<typeof getDbClient>,
	createdBefore: Date
): Promise<Set<string> | null> {
	try {
		// Age-filtered for the same reason the rows are, and it is the object
		// side that makes it load-bearing. `uploadSceneAssets` writes the object
		// first and inserts the row a moment later, so a save running during this
		// script produces an object with no row yet - indistinguishable from a
		// real orphan, and deleting it strands a live scene. Nothing recent is
		// examined at all, which is the only way that stays safe.
		const rows = await db.execute<{ name: string }>(
			sql`select name from storage.objects
				where bucket_id = ${STORAGE_BUCKET}
					and created_at < ${createdBefore.toISOString()}`
		)
		return new Set([...rows].map((row) => row.name))
	} catch (error) {
		console.warn(
			'Could not read storage.objects (%s). Object-side orphans cannot be ' +
				'detected without it; row-side findings below are still complete.',
			error instanceof Error ? error.message : String(error)
		)
		return null
	}
}

async function main() {
	const options = parseArgs(process.argv.slice(2))
	const databaseUrl = process.env.DATABASE_URL

	if (!databaseUrl) {
		throw new Error('DATABASE_URL is not set.')
	}

	const host = new URL(databaseUrl).hostname
	const db = getDbClient()

	console.info('Target: %s (older than %dh)', host, options.olderThanHours)

	const cutoff = new Date(Date.now() - options.olderThanHours * 60 * 60 * 1000)

	// Bucket first, rows second. A row inserted between the two reads is then
	// still present in `allAssetRows`, so its object cannot be called orphaned;
	// the reverse order leaves that window open.
	const storageObjectNames = await readStorageObjectNames(db, cutoff)

	// Two different populations, and conflating them destroys live data.
	//
	// The age cutoff decides what may be *deleted*: an upload in flight is
	// legitimately unreferenced for the length of its save. It must not decide
	// what is *known*, because an object is called orphaned only when no row
	// names it, and a row newer than the cutoff still names its object. Filtering
	// both by age reports every object uploaded today as an orphan and, under
	// --apply, deletes the bytes out from under rows that are still in use.
	//
	// One read, carrying `created_at`, is what makes that split safe. Asking for
	// the recent ids separately would put the age test and the row list in
	// different snapshots, and a row inserted between the two reads would appear
	// in the list while missing from the recent set - eligible for deletion at
	// the exact moment its upload is still in flight.
	const allAssetRows: (OrphanAssetRow & { createdAt: Date })[] = await db
		.select({
			id: assets.id,
			filePath: assets.filePath,
			fileSize: assets.fileSize,
			createdAt: assets.createdAt
		})
		.from(assets)

	const recentIds = new Set(
		allAssetRows.filter((row) => row.createdAt >= cutoff).map((row) => row.id)
	)
	const assetRows = allAssetRows.filter((row) => !recentIds.has(row.id))

	// Chunked because `selectUnreferencedAssetIds` builds three `in (...)`
	// predicates from the list.
	const unreferencedIds = new Set<string>()
	for (let i = 0; i < assetRows.length; i += REFERENCE_CHUNK) {
		const chunk = assetRows.slice(i, i + REFERENCE_CHUNK).map((row) => row.id)
		for (const id of await selectUnreferencedAssetIds(chunk)) {
			unreferencedIds.add(id)
		}
	}

	const report = partitionOrphans({
		allAssetRows,
		unreferencedIds,
		storageObjectNames: storageObjectNames ?? new Set()
	})

	// Without a bucket listing every path looks absent, which would misreport
	// live rows as broken and every object as unseen.
	const storageOrphans = storageObjectNames ? report.storageOrphans : []
	// A recent row's object is deliberately absent from the age-filtered listing,
	// so it would otherwise be reported as a row whose file has gone missing.
	// Only rows old enough for their object to have been listed can be dangling.
	const danglingReferencedRows = storageObjectNames
		? report.danglingReferencedRows.filter((row) => !recentIds.has(row.id))
		: []

	console.info('')
	console.info(
		'Rows (total / eligible):    %d / %d',
		allAssetRows.length,
		assetRows.length
	)
	console.info(
		'Unreferenced rows:          %d (%s)',
		report.unreferencedRows.length,
		formatBytes(report.bytes.unreferenced)
	)
	console.info('Objects with no row:        %d', storageOrphans.length)
	console.info(
		'Referenced rows, no object: %d (reported only)',
		danglingReferencedRows.length
	)

	if (options.outPath) {
		await writeFile(
			options.outPath,
			JSON.stringify(
				{
					host,
					olderThanHours: options.olderThanHours,
					unreferencedRows: report.unreferencedRows,
					storageOrphans,
					danglingReferencedRows
				},
				null,
				2
			)
		)
		console.info('Manifest written to %s', options.outPath)
	}

	if (!options.apply) {
		console.info('')
		console.info(
			'Report only. Re-run with --apply --confirm-host=%s to delete.',
			host
		)
		return
	}

	if (options.confirmHost !== host) {
		throw new Error(
			`--apply requires --confirm-host=${host} (got ${options.confirmHost ?? 'nothing'}).`
		)
	}

	const deleteCount = report.unreferencedRows.length + storageOrphans.length
	if (deleteCount > options.maxDeletes) {
		throw new Error(
			`Refusing to delete ${deleteCount} items, over --max-deletes=${options.maxDeletes}. ` +
				'Raise the cap deliberately after reading the manifest.'
		)
	}

	// Rows first: `deleteAssets` removes each object before its row, so a failure
	// part way leaves a row pointing at a missing file, which the next report
	// surfaces. The reverse order would lose the path and produce an orphan
	// nothing can name.
	await deleteAssets(report.unreferencedRows.map((row) => row.id))
	await deleteStorageObjects(storageOrphans)

	console.info('')
	console.info(
		'Deleted %d rows and %d objects.',
		report.unreferencedRows.length,
		storageOrphans.length
	)
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error instanceof Error ? error.message : error)
		process.exit(1)
	})
