import type { HeroState, HeroStore } from './hero-store'

/**
 * Makes the whole sheet a drop target for files, showing the `dragging` status
 * while files hover and restoring the one before when they leave. Returns the
 * function that detaches it, which also ends a drag in progress.
 *
 * Files dragged over the sheet are always claimed, so a drop can never fall
 * through to the browser and navigate away from the page; while the stage is
 * busy they are claimed and ignored.
 */
export function attachFileDrop(
	sheet: HTMLElement,
	store: HeroStore,
	onFiles: (files: File[]) => void
): () => void {
	let depth = 0
	let before: HeroState['status'] | null = null
	const endDrag = () => {
		depth = 0
		sheet.removeAttribute('data-dragging')
		if (before) store.set({ status: before })
		before = null
	}
	const carriesFiles = (event: DragEvent) =>
		event.dataTransfer?.types.includes('Files') ?? false
	const onDragEnter = (event: DragEvent) => {
		if (!carriesFiles(event)) return
		event.preventDefault()
		if (store.get().busy) return
		if (depth++ === 0) {
			before = store.get().status
			sheet.setAttribute('data-dragging', '')
			store.set({ status: 'dragging' })
		}
	}
	const onDragOver = (event: DragEvent) => {
		if (carriesFiles(event)) event.preventDefault()
	}
	const onDragLeave = () => {
		if (depth && --depth === 0) endDrag()
	}
	const onDrop = (event: DragEvent) => {
		if (!carriesFiles(event)) return
		event.preventDefault()
		if (!depth) return
		endDrag()
		const files = [...(event.dataTransfer?.files ?? [])]
		if (files.length) onFiles(files)
	}

	sheet.addEventListener('dragenter', onDragEnter)
	sheet.addEventListener('dragover', onDragOver)
	sheet.addEventListener('dragleave', onDragLeave)
	sheet.addEventListener('drop', onDrop)

	return () => {
		sheet.removeEventListener('dragenter', onDragEnter)
		sheet.removeEventListener('dragover', onDragOver)
		sheet.removeEventListener('dragleave', onDragLeave)
		sheet.removeEventListener('drop', onDrop)
		endDrag()
	}
}
