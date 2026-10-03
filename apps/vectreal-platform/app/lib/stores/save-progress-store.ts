import { atom } from 'jotai'

import { reduceSaveProgress } from '../domain/scene/client/scene-save-progress'

import type {
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
 * Feeds one save event to the panel. A file's preview becomes an object URL
 * here, so the panel holds a short string and never the bytes, and the URLs
 * are revoked when the next save starts or the panel is dismissed.
 */
const dispatchSaveProgressAtom = atom(
	null,
	(get, set, event: SaveProgressEvent) => {
		const previous = get(savePanelAtom)
		if (event.type === 'preparing') revokePreviews(previous)

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

export { savePanelAtom, dispatchSaveProgressAtom, dismissSavePanelAtom }
