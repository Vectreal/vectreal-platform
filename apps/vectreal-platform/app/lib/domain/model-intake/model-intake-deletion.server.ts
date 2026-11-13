import {
	deleteExpiredIntakeLetters,
	deleteIntakeRow,
	findExistingIntakeIds,
	findIntakeByReference,
	findIntakeForDeletion,
	selectExpiredIntakeLetters,
	selectExpiredIntakes
} from './model-intake-repository.server'
import {
	deleteIntakeFolder,
	listIntakeFolderIds
} from './model-intake-storage.server'

/**
 * Removes one request: its whole folder first (photos and anything attached
 * from its link), then the row. A failed delete throws before the row goes,
 * so the next purge finds the request again and retries.
 */
async function deleteIntake(row: { id: string }) {
	await deleteIntakeFolder(row.id)
	await deleteIntakeRow(row.id)
}

/** From the internal page. Returns false for an id that does not exist. */
export async function deleteIntakeById(id: string): Promise<boolean> {
	const row = await findIntakeForDeletion(id)
	if (!row) return false
	await deleteIntake(row)
	return true
}

/** A brand's deletion request quotes its reference code. */
export async function deleteIntakeByReference(
	referenceCode: string
): Promise<boolean> {
	const row = await findIntakeByReference(referenceCode)
	if (!row) return false
	await deleteIntake(row)
	return true
}

/**
 * Request folders in the bucket with no row. A row is always written before
 * anything is stored for it, so a folder without one is left over: most
 * often a file staff attached whose upload finished after the request was
 * deleted. Nothing else would ever find it.
 */
async function selectOrphanFolders(): Promise<string[]> {
	const ids = await listIntakeFolderIds()
	const existing = await findExistingIntakeIds(ids)
	return ids.filter((id) => !existing.has(id))
}

/**
 * What a purge at `now` removes: requests past their `deleteAfter`, the
 * letters past retention that no remaining request names, and folders whose
 * request is gone.
 */
export async function selectPurge(now: Date) {
	const [requests, letters, orphans] = await Promise.all([
		selectExpiredIntakes(now),
		selectExpiredIntakeLetters(now),
		selectOrphanFolders()
	])
	return { requests, letters, orphans }
}

/**
 * Removes requests past their `deleteAfter`, then the letters past retention
 * that no remaining request names, then folders whose request is gone, and
 * returns what went.
 */
export async function purgeExpiredIntakes(now: Date) {
	const requests = await selectExpiredIntakes(now)
	for (const row of requests) {
		await deleteIntake(row)
	}
	const letters = await deleteExpiredIntakeLetters(now)
	const orphans = await selectOrphanFolders()
	for (const id of orphans) {
		await deleteIntakeFolder(id)
	}
	return { requests, letters, orphans }
}
