/**
 * What a save or a publish is doing, as events the orchestrators emit and the
 * state the progress panel renders from them.
 *
 * A save is grouped by what it stores rather than listed file by file, so the
 * panel can stay a small summary: the model's files, the preview images, and
 * the settings committed last. A publish saves first when anything is unsaved,
 * so it shows that save the same way, then its own steps.
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

/** A publish's own steps, in the order they run. */
export type PublishStepKey = 'export' | 'textures' | 'upload' | 'commit'

const PUBLISH_STEP_ORDER: PublishStepKey[] = [
	'export',
	'textures',
	'upload',
	'commit'
]

export type PublishProgressEvent =
	/** `saves`: unsaved changes are saved first, reported as a save's events. */
	| { type: 'publish-started'; saves: boolean }
	/**
	 * A step runs, with how far it has come where that is known: textures
	 * count, the upload counts bytes. Every step before it has finished.
	 */
	| { type: 'publish-step'; key: PublishStepKey; done?: number; total?: number }
	| { type: 'published' }
	/**
	 * The publish ended without shipping, for whatever reason, its own save
	 * included, which has then already sent its own `failed`.
	 */
	| { type: 'publish-failed'; message: string }

export type SaveFileState =
	'waiting' | 'uploading' | 'done' | 'reused' | 'failed'

export interface PublishStep {
	key: PublishStepKey
	/** How far it has come, in the step's unit; both 0 while that is unknown. */
	done: number
	total: number
	state: 'waiting' | 'active' | 'done' | 'failed'
}

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
	| 'preparing'
	| 'uploading'
	| 'committing'
	| 'publishing'
	| 'saved'
	| 'unchanged'
	| 'published'
	| 'failed'

export interface SavePanelState {
	status: SaveStatus
	files: SavePanelFile[]
	/** Why the save or publish did not complete. */
	message: string | null
	/** Present while the panel shows a publish, and only then. */
	publish?: { steps: PublishStep[] }
}

/** Whether a save or a publish has started and not yet finished, either way. */
export const isSaveInFlight = (state: SavePanelState | null): boolean =>
	state?.status === 'preparing' ||
	state?.status === 'uploading' ||
	state?.status === 'committing' ||
	state?.status === 'publishing'

/** Whether it ended well: saved, already up to date, or published. */
export const isProgressFinished = (status: SaveStatus): boolean =>
	status === 'saved' || status === 'unchanged' || status === 'published'

/**
 * Where the save part stands. Within a publish the save is over once any
 * publish step has run, so a publish that fails later still reads as saved.
 */
export const saveStepStatus = (state: SavePanelState): SaveStatus => {
	if (!state.publish) return state.status
	const publishRan = state.publish.steps.some(
		(step) => step.state !== 'waiting'
	)
	if (publishRan) return 'saved'
	return state.status === 'publishing' ? 'saved' : state.status
}

/** The panel's input: a file arrives with its preview already turned into a URL. */
export type SavePanelEvent =
	| Exclude<SaveProgressEvent, { type: 'file-added' }>
	| PublishProgressEvent
	| {
			type: 'file-added'
			file: Omit<SaveFile, 'preview'>
			previewUrl: string | null
	  }

const waitingStep = (key: PublishStepKey): PublishStep => ({
	key,
	done: 0,
	total: 0,
	state: 'waiting'
})

/*
  Runs `key` and finishes every step before it. Textures run only when GPU
  compression is on, so that step joins the list the first time it reports.
*/
const runStep = (
	steps: PublishStep[],
	key: PublishStepKey,
	done = 0,
	total = 0
): PublishStep[] => {
	const listed = steps.some((step) => step.key === key)
		? steps
		: [...steps, waitingStep(key)].sort(
				(a, b) =>
					PUBLISH_STEP_ORDER.indexOf(a.key) - PUBLISH_STEP_ORDER.indexOf(b.key)
			)
	const at = PUBLISH_STEP_ORDER.indexOf(key)
	return listed.map((step) => {
		const order = PUBLISH_STEP_ORDER.indexOf(step.key)
		if (step.key === key) return { ...step, done, total, state: 'active' }
		return order < at ? { ...step, state: 'done' } : step
	})
}

/** A publish's progress, or null when the panel shows a plain save. */
const reducePublishProgress = (
	state: SavePanelState | null,
	event: SavePanelEvent
): SavePanelState | null | undefined => {
	if (event.type === 'publish-started') {
		return {
			status: event.saves ? 'preparing' : 'publishing',
			files: [],
			message: null,
			publish: {
				steps: [
					waitingStep('export'),
					waitingStep('upload'),
					waitingStep('commit')
				]
			}
		}
	}
	// A finished publish is only what the panel last showed; the next save
	// starts over like any other.
	const publish = state?.publish
	if (!state || !publish || !isSaveInFlight(state)) return undefined

	switch (event.type) {
		// The save a publish runs first keeps the publish on screen, and its
		// finishing hands over to the publish's own steps.
		case 'preparing':
			return { ...state, status: 'preparing' }
		case 'saved':
			return { ...state, status: 'publishing' }
		case 'publish-step':
			return {
				...state,
				status: 'publishing',
				publish: {
					steps: runStep(publish.steps, event.key, event.done, event.total)
				}
			}
		case 'published':
			return {
				...state,
				status: 'published',
				publish: {
					steps: publish.steps.map((step) => ({ ...step, state: 'done' }))
				}
			}
		case 'failed':
		case 'publish-failed':
			return {
				...state,
				status: 'failed',
				message: event.message,
				publish: {
					steps: publish.steps.map((step) =>
						step.state === 'active' ? { ...step, state: 'failed' } : step
					)
				}
			}
		default:
			return undefined
	}
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
	const publishing = reducePublishProgress(state, event)
	if (publishing !== undefined) return publishing

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
		// A publish's own steps mean nothing once it is no longer running, and
		// one whose save already failed keeps showing that save's failure.
		case 'publish-started':
		case 'publish-step':
		case 'published':
		case 'publish-failed':
			return state
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
	/**
	 * 0 to 100, by bytes: one large texture and one small buffer are not equal
	 * steps. While a publish runs its own steps, the running step's share
	 * instead, or null when that step cannot say how far it has come.
	 */
	percent: number | null
	groups: SaveGroupSummary[]
	/** The publish step running now, while one is. */
	activeStep: PublishStep | null
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
	const activeStep =
		state.status === 'publishing'
			? (state.publish?.steps.find((step) => step.state === 'active') ?? null)
			: null

	return {
		bytes,
		sent,
		activeStep,
		percent: isProgressFinished(state.status)
			? 100
			: state.status === 'publishing'
				? activeStep && activeStep.total > 0
					? (activeStep.done / activeStep.total) * 100
					: null
				: bytes > 0
					? (sent / bytes) * 100
					: 0,
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
