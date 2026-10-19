const listNames = (names: string[]): string => {
	const quoted = names.map((name) => `"${name}"`)
	return quoted.length === 1
		? quoted[0]
		: `${quoted.slice(0, -1).join(', ')} and ${quoted[quoted.length - 1]}`
}

/**
 * What deleting a camera took with it, or null when it took nothing the author
 * made.
 *
 * Deleting a camera unlinks the hotspots that used it and drops the
 * interactions that switched to it. Neither shows up in the camera panel, so
 * without this the author finds out on the hotspot panel, or never.
 */
export function describeCameraRemoval(
	/** As the hotspot panel lists them (`hotspotDisplayName`). */
	unlinkedHotspotNames: string[],
	interactionCount: number
): string | null {
	const parts: string[] = []

	if (unlinkedHotspotNames.length > 0) {
		const verb = unlinkedHotspotNames.length === 1 ? 'has' : 'have'
		parts.push(`${listNames(unlinkedHotspotNames)} no longer ${verb} a camera.`)
	}

	if (interactionCount > 0) {
		parts.push(
			interactionCount === 1
				? '1 interaction no longer switches to it.'
				: `${interactionCount} interactions no longer switch to it.`
		)
	}

	return parts.length > 0 ? `Camera deleted. ${parts.join(' ')}` : null
}
