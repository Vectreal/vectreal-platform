import {
	deleteIntakeRow,
	findIntakeByReference,
	findIntakeForDeletion,
	selectExpiredIntakes
} from './model-intake-repository.server'
import { deleteIntakePhotos } from './model-intake-storage.server'

/**
 * Removes one request: photos first, then the row. A failed photo delete
 * throws before the row goes, so the row still names what is left to retry.
 */
async function deleteIntake(row: { id: string; photoPaths: string[] }) {
	await deleteIntakePhotos(row.photoPaths)
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

/** Every request past its `deleteAfter`. Returns how many were removed. */
export async function purgeExpiredIntakes(now: Date): Promise<number> {
	const expired = await selectExpiredIntakes(now)
	for (const row of expired) {
		await deleteIntake(row)
	}
	return expired.length
}
