/**
 * What a save is doing, as events the orchestrator emits and the state the
 * save panel renders from them.
 *
 * A save is grouped by what it stores rather than listed file by file, so the
 * panel can stay a small summary: the model's files, the preview images, and
 * the settings committed last.
 */

/** The groups that hold files. The settings are one step, not files. */
export type SaveFileGroup = 'model' | 'original' | 'preview'

export interface SaveFile {
	/** Unique within one save. */
	key: string
	group: SaveFileGroup
	name: string
	bytes: number
	/** An image to show beside the name, when the file is one. */
	preview: Blob | null
}

export type SaveProgressEvent =
	| { type: 'preparing' }
	| { type: 'file-added'; file: SaveFile }
	| { type: 'file-progress'; key: string; fraction: number }
	/** `reused`: the server already held these exact bytes, so nothing was sent. */
	| { type: 'file-done'; key: string; reused: boolean }
	| { type: 'file-failed'; key: string }
	| { type: 'committing' }
	| { type: 'saved'; unchanged: boolean }
	| { type: 'failed'; message: string }

export type SaveFileState =
	'waiting' | 'uploading' | 'done' | 'reused' | 'failed'

export interface SavePanelFile {
	key: string
	group: SaveFileGroup
	name: string
	bytes: number
	/** An object URL the panel owns; revoked when the panel is cleared. */
	previewUrl: string | null
	sent: number
	state: SaveFileState
}

export type SaveStatus =
	'preparing' | 'uploading' | 'committing' | 'saved' | 'unchanged' | 'failed'

export interface SavePanelState {
	status: SaveStatus
	files: SavePanelFile[]
	/** Why the save did not complete. */
	message: string | null
}

/** Whether a save has started and not yet finished, either way. */
export const isSaveInFlight = (state: SavePanelState | null): boolean =>
	state?.status === 'preparing' ||
	state?.status === 'uploading' ||
	state?.status === 'committing'

/** The panel's input: a file arrives with its preview already turned into a URL. */
export type SavePanelEvent =
	| Exclude<SaveProgressEvent, { type: 'file-added' }>
	| {
			type: 'file-added'
			file: Omit<SaveFile, 'preview'>
			previewUrl: string | null
	  }

const updateFile = (
	state: SavePanelState,
	key: string,
	update: (file: SavePanelFile) => SavePanelFile
): SavePanelState => ({
	...state,
	files: state.files.map((file) => (file.key === key ? update(file) : file))
})

export const reduceSaveProgress = (
	state: SavePanelState | null,
	event: SavePanelEvent
): SavePanelState | null => {
	// A save always starts here, so whatever the panel showed before is gone.
	if (event.type === 'preparing') {
		return { status: 'preparing', files: [], message: null }
	}
	// A save can fail before it reports anything, and that still has to show.
	if (event.type === 'failed') {
		return {
			status: 'failed',
			files: state?.files ?? [],
			message: event.message
		}
	}
	if (!state) return state

	switch (event.type) {
		case 'file-added':
			return {
				...state,
				files: [
					...state.files,
					{
						...event.file,
						previewUrl: event.previewUrl,
						sent: 0,
						state: 'waiting'
					}
				]
			}
		case 'file-progress':
			return updateFile(
				{ ...state, status: 'uploading' },
				event.key,
				(file) => ({
					...file,
					state: 'uploading',
					sent: Math.round(file.bytes * event.fraction)
				})
			)
		case 'file-done':
			return updateFile(
				{ ...state, status: 'uploading' },
				event.key,
				(file) => ({
					...file,
					state: event.reused ? 'reused' : 'done',
					sent: file.bytes
				})
			)
		case 'file-failed':
			return updateFile(state, event.key, (file) => ({
				...file,
				state: 'failed'
			}))
		case 'committing':
			return { ...state, status: 'committing' }
		case 'saved':
			return { ...state, status: event.unchanged ? 'unchanged' : 'saved' }
	}
}

export interface SaveGroupSummary {
	group: SaveFileGroup
	files: SavePanelFile[]
	bytes: number
	sent: number
	reused: number
	state: 'waiting' | 'active' | 'done' | 'failed'
}

export interface SaveProgressSummary {
	bytes: number
	sent: number
	/** 0 to 100, by bytes: one large texture and one small buffer are not equal steps. */
	percent: number
	groups: SaveGroupSummary[]
}

const GROUP_ORDER: SaveFileGroup[] = ['model', 'original', 'preview']

const groupState = (files: SavePanelFile[]): SaveGroupSummary['state'] => {
	if (files.some((file) => file.state === 'failed')) return 'failed'
	if (files.every((file) => file.state === 'done' || file.state === 'reused')) {
		return 'done'
	}
	return files.some((file) => file.state !== 'waiting') ? 'active' : 'waiting'
}

export const summarizeSaveProgress = (
	state: SavePanelState
): SaveProgressSummary => {
	const bytes = state.files.reduce((total, file) => total + file.bytes, 0)
	const sent = state.files.reduce((total, file) => total + file.sent, 0)
	const isFinished = state.status === 'saved' || state.status === 'unchanged'

	return {
		bytes,
		sent,
		percent: isFinished ? 100 : bytes > 0 ? (sent / bytes) * 100 : 0,
		groups: GROUP_ORDER.flatMap((group) => {
			const files = state.files.filter((file) => file.group === group)
			if (files.length === 0) return []
			return [
				{
					group,
					files,
					bytes: files.reduce((total, file) => total + file.bytes, 0),
					sent: files.reduce((total, file) => total + file.sent, 0),
					reused: files.filter((file) => file.state === 'reused').length,
					state: groupState(files)
				}
			]
		})
	}
}
