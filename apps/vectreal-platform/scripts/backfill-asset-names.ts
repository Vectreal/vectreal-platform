/**
 * Renames stored assets to the names their own glTF refers to them by.
 *
 * Run via: pnpm nx run vectreal-platform:backfill-asset-names
 *
 * This is a DML correction, not a schema change, so it is a script rather than
 * a migration: `drizzle-generate` output is derived from the schema and must
 * stay that way.
 *
 * WHY. A stored asset used to be named by its basename while the saved glTF
 * kept the folder URIs it was written with. PR #883 made the stored name the
 * whole URI, because two files called `diffuse.png` in sibling folders were
 * collapsing into one. Reuse on save matches by exact name, so every scene
 * saved before that no longer matches itself: its first re-save uploads every
 * asset again while the old rows are still linked, and the organization's
 * storage quota counts both copies until the save commits. An organization near
 * its limit is refused, and cannot retry out of it, because the retry is what
 * would have freed the bytes. Renaming the old rows removes the re-upload.
 *
 * Runs once, and is safe to run again: a row already carrying its URI is
 * skipped rather than matched a second time.
 *
 * WHAT IT WILL NOT DO. A scene whose glTF names two files that were stored as
 * one is reported and left alone. The old save already lost one of the two, so
 * there is nothing to rename it to; the flat name keeps that scene loading
 * exactly as it does today, through the loader's name-only rung.
 *
 * SAFETY, the same shape as `purge-orphaned-assets.ts`. Reporting is the
 * default. Writing needs `--apply` together with `--confirm-host`, which must
 * match the host in `DATABASE_URL`, so pointing at the wrong environment has to
 * be deliberate rather than a shell-history accident.
 *
 *   --apply                 permit renaming; refused without --confirm-host
 *   --confirm-host=<host>   must equal the host in DATABASE_URL
 *   --max-renames=<n>       abort before renaming more than this (default 2000)
 *   --scene=<uuid>          restrict to one scene, for a rehearsal
 *   --out=<path>            write the full manifest as JSON
 *
 * Flags take the `--name=value` form; a space-separated value is not read, and
 * falls back to the default rather than to something more permissive.
 *
 * Environment (no `envFile` on the nx target, on purpose - the operator states
 * which environment this is):
 *   DATABASE_URL, SUPABASE_URL, SUPABASE_SECRET_KEY
 */
import { writeFile } from 'node:fs/promises'

import { eq, inArray } from 'drizzle-orm'

import { getDbClient } from '../app/db/client'
import { assets, sceneAssets, sceneSettings } from '../app/db/schema'
import {
	planSceneAssetNameBackfill,
	type AssetRename
} from '../app/lib/domain/asset/asset-name-backfill'
import { downloadAssets } from '../app/lib/domain/asset/asset-storage.server'

const GLTF_MIME_TYPE = 'model/gltf+json'

interface Options {
	apply: boolean
	confirmHost: string | null
	maxRenames: number
	sceneId: string | null
	outPath: string | null
}

function parseArgs(argv: string[]): Options {
	const get = (name: string) => {
		const hit = argv.find((arg) => arg.startsWith(`--${name}=`))
		return hit ? hit.slice(name.length + 3) : null
	}

	const positiveNumber = (name: string, fallback: number, min: number) => {
		const raw = get(name)
		if (raw === null) return fallback

		// A blank value is rejected rather than coerced, for the reason
		// `purge-orphaned-assets` gives: `Number('')` is 0, so an unset shell
		// variable would silently switch the cap off instead of raising it.
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
		maxRenames: positiveNumber('max-renames', 2000, 0),
		sceneId: get('scene'),
		outPath: get('out')
	}
}

interface SceneReport {
	sceneId: string
	renames: AssetRename[]
	collisions: Array<{ storedName: string; wantedBy: string[] }>
	unmatchedUris: string[]
	skipped?: string
}

/**
 * Every scene that has saved settings, with the asset rows linked to it.
 *
 * Ordered, because the manifest is meant to be diffable between a rehearsal and
 * the real run, and an unordered read makes two identical runs look different.
 */
async function readScenes(
	db: ReturnType<typeof getDbClient>,
	sceneId: string | null
) {
	const settingsRows = await db
		.select({ id: sceneSettings.id, sceneId: sceneSettings.sceneId })
		.from(sceneSettings)
		.where(sceneId ? eq(sceneSettings.sceneId, sceneId) : undefined)
		.orderBy(sceneSettings.sceneId)

	return settingsRows
}

async function planScene(
	db: ReturnType<typeof getDbClient>,
	settingsId: string,
	sceneId: string
): Promise<SceneReport> {
	const empty: SceneReport = {
		sceneId,
		renames: [],
		collisions: [],
		unmatchedUris: []
	}

	const linkRows = await db
		.select({ assetId: sceneAssets.assetId })
		.from(sceneAssets)
		.where(eq(sceneAssets.sceneSettingsId, settingsId))

	const assetIds = linkRows.map((row) => row.assetId)
	if (assetIds.length === 0) return { ...empty, skipped: 'no linked assets' }

	const assetRows = await db
		.select({ id: assets.id, name: assets.name, mimeType: assets.mimeType })
		.from(assets)
		.where(inArray(assets.id, assetIds))
		.orderBy(assets.name)

	/*
	  By MIME type, not by the name `scene.gltf`, because the name is exactly
	  what this script is here to change and a published scene stores a GLB under
	  a different one. `getSceneSettings` identifies it the same way.
	*/
	const gltfRow = assetRows.find((row) => row.mimeType === GLTF_MIME_TYPE)
	if (!gltfRow) return { ...empty, skipped: 'no glTF asset (published GLB?)' }

	const downloaded = await downloadAssets([gltfRow.id])
	const gltfData = downloaded.get(gltfRow.id)
	if (!gltfData) return { ...empty, skipped: 'glTF object missing from bucket' }

	let gltfJson: unknown
	try {
		gltfJson = JSON.parse(new TextDecoder().decode(gltfData.data))
	} catch (error) {
		return {
			...empty,
			skipped: `glTF did not parse (${error instanceof Error ? error.message : String(error)})`
		}
	}

	const plan = planSceneAssetNameBackfill({
		gltfJson,
		assetRows: assetRows.map((row) => ({ id: row.id, name: row.name }))
	})

	return { sceneId, ...plan }
}

async function main() {
	const options = parseArgs(process.argv.slice(2))
	const databaseUrl = process.env.DATABASE_URL

	if (!databaseUrl) {
		throw new Error('DATABASE_URL is not set.')
	}

	const host = new URL(databaseUrl).hostname
	const db = getDbClient()

	console.info(
		'Target: %s%s',
		host,
		options.sceneId ? ` (scene ${options.sceneId} only)` : ''
	)

	const scenes = await readScenes(db, options.sceneId)
	console.info('Scenes with saved settings: %d', scenes.length)

	const reports: SceneReport[] = []
	for (const scene of scenes) {
		reports.push(await planScene(db, scene.id, scene.sceneId))
	}

	const renames = reports.flatMap((report) => report.renames)
	const withCollisions = reports.filter(
		(report) => report.collisions.length > 0
	)
	const withUnmatched = reports.filter(
		(report) => report.unmatchedUris.length > 0
	)

	console.info('')
	console.info('Assets to rename:            %d', renames.length)
	console.info('Scenes needing a rename:     %d', reports.filter((report) => report.renames.length > 0).length) // prettier-ignore
	console.info('Scenes with a merged asset:  %d', withCollisions.length)
	console.info('Scenes with a missing asset: %d', withUnmatched.length)

	for (const report of withCollisions) {
		for (const collision of report.collisions) {
			console.warn(
				'  scene %s: %s is referenced as %s - left alone, one of those files was never stored',
				report.sceneId,
				collision.storedName,
				collision.wantedBy.join(' and ')
			)
		}
	}

	if (options.outPath) {
		await writeFile(options.outPath, JSON.stringify(reports, null, 2), 'utf8')
		console.info('')
		console.info('Manifest written to %s', options.outPath)
	}

	if (!options.apply) {
		console.info('')
		console.info(
			'Report only. Re-run with --apply --confirm-host=%s to rename.',
			host
		)
		return
	}

	if (options.confirmHost !== host) {
		throw new Error(
			`--apply requires --confirm-host=${host} (got ${options.confirmHost ?? 'nothing'}).`
		)
	}

	if (renames.length > options.maxRenames) {
		throw new Error(
			`Refusing to rename ${renames.length} assets, over --max-renames=${options.maxRenames}. ` +
				'Raise the cap deliberately after reading the manifest.'
		)
	}

	/*
	  One statement per row rather than a bulk update: the whole point is that a
	  partial run is safe. Each rename is independently correct, and a run that
	  stops halfway leaves the rest for the next one, which will re-derive the
	  same plan from the rows it has not yet touched.
	*/
	for (const rename of renames) {
		await db
			.update(assets)
			.set({ name: rename.to })
			.where(eq(assets.id, rename.assetId))
	}

	console.info('')
	console.info('Renamed %d assets.', renames.length)
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error instanceof Error ? error.message : error)
		process.exit(1)
	})
