/**
 * Whether two asset id sets differ, ignoring order.
 *
 * All that is left of this module. The glTF extraction and hashing helpers it
 * used to hold existed only for the legacy save and publish paths on
 * `SceneSettingsService`, which were unreachable and have been removed; assets
 * now travel as ids that the client uploads before it commits, so nothing on
 * the server takes a glTF document apart any more.
 */
export function compareAssetIds(
	currentIds: string[],
	existingIds: string[]
): boolean {
	if (currentIds.length !== existingIds.length) return true

	const sortedCurrent = [...currentIds].sort()
	const sortedExisting = [...existingIds].sort()

	return sortedCurrent.some((id, index) => id !== sortedExisting[index])
}
