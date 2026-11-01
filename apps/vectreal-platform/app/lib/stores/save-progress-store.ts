import { atom } from 'jotai'

import {
	isSaveInFlight,
	reduceSaveProgress
} from '../domain/scene/client/scene-save-progress'

import type {
	PublishProgressEvent,
	SavePanelState,
	SaveProgressEvent
} from '../domain/scene/client/scene-save-progress'

/** What the save panel shows; null while there is nothing to show. */
const savePanelAtom = atom<SavePanelState | null>(null)

const revokePreviews = (state: SavePanelState | null) => {
	for (const file of state?.files ?? []) {
		if (file.previewUrl) URL.revokeObjectURL(file.previewUrl)
	}
}

/**
 * Feeds one save or publish event to the panel. A file's preview becomes an
 * object URL here, so the panel holds a short string and never the bytes, and
 * the URLs are revoked when the next save or publish starts or the panel is
 * dismissed.
 */
const dispatchSaveProgressAtom = atom(
	null,
	(get, set, event: SaveProgressEvent | PublishProgressEvent) => {
		const previous = get(savePanelAtom)
		// The save a publish runs first starts inside it and keeps its files.
		if (
			event.type === 'publish-started' ||
			(event.type === 'preparing' &&
				!(previous?.publish && isSaveInFlight(previous)))
		) {
			revokePreviews(previous)
		}

		if (event.type === 'file-added') {
			const { preview, ...file } = event.file
			set(
				savePanelAtom,
				reduceSaveProgress(previous, {
					type: 'file-added',
					file,
					previewUrl: preview ? URL.createObjectURL(preview) : null
				})
			)
			return
		}

		set(savePanelAtom, reduceSaveProgress(previous, event))
	}
)

const dismissSavePanelAtom = atom(null, (get, set) => {
	revokePreviews(get(savePanelAtom))
	set(savePanelAtom, null)
})

/**
 * The save or publish running now, or null. One panel shows one of them, so
 * the publisher starts neither while the other runs: Save waits out a
 * publish, and Publish waits out a save.
 */
const runningOperationAtom = atom<'save' | 'publish' | null>((get) => {
	const state = get(savePanelAtom)
	if (!isSaveInFlight(state)) return null
	return state?.publish ? 'publish' : 'save'
})

export {
	savePanelAtom,
	dispatchSaveProgressAtom,
	dismissSavePanelAtom,
	runningOperationAtom
}
