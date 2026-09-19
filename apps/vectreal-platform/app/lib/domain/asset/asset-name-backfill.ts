/**
 * Which stored assets of a saved scene still carry the flattened name, and what
 * the glTF calls them instead.
 *
 * WHY THIS EXISTS. A stored asset used to be named by its basename while the
 * saved glTF kept the folder URIs it was written with. PR #883 made the stored
 * name the whole URI, which is what stops `body/diffuse.png` and
 * `wheels/diffuse.png` from collapsing into one file. Reuse on save matches by
 * exact name, so a scene saved before that no longer matches itself: its first
 * re-save uploads every asset again while the old rows are still linked, and
 * the organization's quota counts both copies until the save commits. An
 * organization near its limit is refused, and cannot retry out of it, because
 * the retry is the thing that would have freed the bytes.
 *
 * Renaming the old rows to the names their own glTF uses removes the
 * re-upload. It is a one-off correction of stored data, so it lives in a script
 * rather than in the save path: nothing here runs in the product.
 *
 * Pure and free of any database or storage import, so it can be unit tested -
 * the modules that talk to Postgres call `getDbClient()` at import time and
 * throw without a `DATABASE_URL`.
 */
import { normalizeAssetUri, referencedUris } from '@vctrl/core'

export interface BackfillAssetRow {
	id: string
	name: string
}

export interface AssetRename {
	assetId: string
	from: string
	to: string
}

export interface SceneBackfillPlan {
	renames: AssetRename[]
	/**
	 * One stored row that two different URIs both want. The old save wrote one
	 * file where two were needed, so one of the two textures is already gone and
	 * no rename recovers it. Reported and never renamed: leaving the flat name
	 * keeps the scene loading exactly as it does today, through the loader's
	 * name-only rung.
	 */
	collisions: Array<{ storedName: string; wantedBy: string[] }>
	/**
	 * A reference no stored row answers under the old flattened spelling. Either
	 * the row already carries its URI (a scene saved after #883, or a second run
	 * of this backfill) or the asset is genuinely missing. Both are reported and
	 * neither is acted on.
	 */
	unmatchedUris: string[]
}

/**
 * The name the old save wrote for a reference.
 *
 * Forward slash only, and deliberately: this reproduces the line #883 deleted
 * (`normalizedName.split('/').pop()`) rather than improving on it. A backfill
 * has to invert the rule that actually ran, so a URI that a better rule would
 * have flattened differently must still be looked up the way it was stored.
 */
const flattenedName = (normalizedUri: string): string =>
	normalizedUri.split('/').pop() || normalizedUri

export function planSceneAssetNameBackfill(params: {
	/** The scene's saved glTF, parsed. */
	gltfJson: unknown
	/** Every asset row linked to the scene, including ones needing no rename. */
	assetRows: BackfillAssetRow[]
}): SceneBackfillPlan {
	const { gltfJson, assetRows } = params

	const byName = new Map<string, BackfillAssetRow>()
	for (const row of assetRows) byName.set(row.name, row)

	/*
	  A set per row, not a list. Two spellings of one reference - `./a/t.png` and
	  `a/t.png` - normalize to the same target, and counting them twice would
	  report one file as a collision with itself and decline to rename it.
	*/
	const wantedBy = new Map<string, Set<string>>()
	const unmatchedUris: string[] = []

	for (const uri of referencedUris(gltfJson)) {
		const target = normalizeAssetUri(uri)

		/*
		  Already answered. Either this row was renamed by an earlier run, or the
		  scene was saved after #883 and never needed it. Checking the target
		  before the flattened spelling is what makes the backfill re-runnable.
		*/
		if (byName.has(target)) continue

		const stored = flattenedName(target)
		// A reference with no folder was stored under the name it already has.
		if (stored === target) continue

		const row = byName.get(stored)
		if (!row) {
			unmatchedUris.push(uri)
			continue
		}

		const claimed = wantedBy.get(row.id) ?? new Set<string>()
		claimed.add(target)
		wantedBy.set(row.id, claimed)
	}

	const renames: AssetRename[] = []
	const collisions: SceneBackfillPlan['collisions'] = []
	const byId = new Map(assetRows.map((row) => [row.id, row]))

	for (const [assetId, claimed] of wantedBy) {
		const row = byId.get(assetId)
		if (!row) continue

		const targets = [...claimed]
		if (targets.length > 1) {
			collisions.push({ storedName: row.name, wantedBy: targets })
			continue
		}

		renames.push({ assetId, from: row.name, to: targets[0] })
	}

	return { renames, collisions, unmatchedUris }
}
