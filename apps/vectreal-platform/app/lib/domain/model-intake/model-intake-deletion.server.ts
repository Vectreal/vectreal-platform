import {
	deleteIntakeLetters,
	deleteIntakeRow,
	findIntakeByReference,
	findIntakeForDeletion,
	selectExpiredIntakeLetters,
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

/**
 * What a purge at `now` removes: requests past their `deleteAfter`, and the
 * letters past retention that no remaining request names.
 */
export async function selectPurge(now: Date) {
	const [requests, letters] = await Promise.all([
		selectExpiredIntakes(now),
		selectExpiredIntakeLetters(now)
	])
	return { requests, letters }
}

/** Removes what `selectPurge` names, requests first, and returns it. */
export async function purgeExpiredIntakes(now: Date) {
	const due = await selectPurge(now)
	for (const row of due.requests) {
		await deleteIntake(row)
	}
	await deleteIntakeLetters(due.letters.map((letter) => letter.code))
	return due
}
