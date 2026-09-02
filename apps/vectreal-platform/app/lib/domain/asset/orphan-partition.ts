/**
 * Classifies the disagreements between the `assets` table and the storage
 * bucket.
 *
 * Pure and free of any database import, so it can be unit tested: the module
 * that talks to Postgres calls `getDbClient()` at import time and throws
 * without a `DATABASE_URL`.
 *
 * The two stores drift apart in both directions, and the directions are not
 * symmetric. A row without an object has lost its bytes; an object without a
 * row has lost its name, and nothing can ever identify it again from the
 * database side. Only the second is safely deletable on sight.
 */

export interface OrphanAssetRow {
	id: string
	filePath: string
	fileSize: number | null
}

export interface OrphanPartition {
	/**
	 * Rows nothing references. Safe to delete: `deleteAssets` tolerates a
	 * missing object and removes the row anyway.
	 */
	unreferencedRows: OrphanAssetRow[]
	/**
	 * Objects with no row naming them. Unreachable by every code path, because
	 * every read starts from `assets.file_path`.
	 */
	storageOrphans: string[]
	/**
	 * Rows something still references whose object is gone. Never deleted here:
	 * a live scene points at these, and the row is the only remaining record of
	 * what the file was. A human needs to look.
	 */
	danglingReferencedRows: OrphanAssetRow[]
	bytes: { unreferenced: number }
}

export function partitionOrphans(params: {
	/**
	 * EVERY asset row, not a filtered subset. An object is called orphaned only
	 * when no row names it, so a caller that passes a filtered list reports the
	 * objects of the rows it filtered out as orphans - and a caller that then
	 * deletes them destroys live data. Narrow with `unreferencedIds` instead,
	 * which is what decides deletion.
	 */
	allAssetRows: OrphanAssetRow[]
	/** Ids from `allAssetRows` that nothing references. */
	unreferencedIds: Set<string>
	/** Every object key present in the bucket. */
	storageObjectNames: Set<string>
}): OrphanPartition {
	const { allAssetRows, unreferencedIds, storageObjectNames } = params

	const unreferencedRows: OrphanAssetRow[] = []
	const danglingReferencedRows: OrphanAssetRow[] = []
	const knownPaths = new Set<string>()

	for (const row of allAssetRows) {
		knownPaths.add(row.filePath)

		if (unreferencedIds.has(row.id)) {
			unreferencedRows.push(row)
			continue
		}

		if (!storageObjectNames.has(row.filePath)) {
			danglingReferencedRows.push(row)
		}
	}

	const storageOrphans = [...storageObjectNames].filter(
		(name) => !knownPaths.has(name)
	)

	return {
		unreferencedRows,
		storageOrphans,
		danglingReferencedRows,
		bytes: {
			unreferenced: unreferencedRows.reduce(
				(total, row) => total + (row.fileSize ?? 0),
				0
			)
		}
	}
}
