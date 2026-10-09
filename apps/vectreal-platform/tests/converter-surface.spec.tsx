// @vitest-environment jsdom
/**
 * What the converter page does with what the loader hands it.
 *
 * WHY THIS FILE EXISTS. `converter-surface.tsx` is where the two numbers a
 * visitor actually reads are computed, where the decision to re-read a file is
 * taken, and where a superseded load is told apart from a winning one - and it
 * had no test at all. Every defect below shipped green, and two of them reached
 * every visitor on every conversion.
 *
 * `load` is driven from here rather than mocked to a fixed value, because the
 * interesting cases are about *when* it resolves: a second drop landing while
 * the first is still in flight is not reachable any other way, and it is the
 * shape this surface has been patched for three times.
 *
 * The viewer is stubbed. It needs WebGL, and what is asserted here is which
 * model reached it, not what it drew.
 *
 * Mutation gates, all executed and each watched failing first:
 *  - adding `sourceTextureBytes` back onto `sourcePackageBytes` reddens the
 *    figures case alone;
 *  - putting `adoptSource` back to `appliedKey.current = null` reddens the
 *    whole first half, because the second read it causes never resolves here
 *    and no result reaches the screen. Blunt, and correct: the second read is
 *    the defect and the spinner was only its symptom;
 *  - making `ingest` adopt unconditionally reddens the superseded-drop case;
 *  - dropping `store`'s guard reddens the conversion-filed-late case;
 *  - dropping the currency check that follows `texturesOptimization` reddens
 *    the WebP case and nothing else, which is the point of that case: the two
 *    checks bracket the pass and each needs a window of its own to be caught
 *    in;
 *  - dropping the currency check that precedes the pass reddens the
 *    superseded-re-read case. The header claimed that check was covered by the
 *    cases above it and it was covered by none of them: `if (false) return null`
 *    left all six green, which is how a guard written in this changeset came to
 *    be the only unmeasured line in the file;
 *  - offering WebP without asking `canEncodeImage` reddens the Safari case
 *    alone;
 *  - not waiting for `stageIngest` in `prepare`, or not handing it over in
 *    `adoptSource`, reddens the first-model and previous-model cases; not
 *    waiting in the handoff reddens both handoff waiting cases;
 *  - dropping `prepare`'s on-screen check after that wait, or capturing its
 *    predicate after the wait instead of before, reddens the
 *    replaced-while-waiting case; capturing the handoff's after it reddens
 *    the handoff's;
 *  - adopting by `stillCurrent` rather than `stillOnScreen` reddens both
 *    refusal cases on the adopted model, and asking it of the WebP re-read
 *    reddens the refusal cases on the re-read one;
 *  - a failed re-read that skips asking whether a newer file replaced it
 *    reddens the case naming the newer file;
 *  - recording the re-read only after its pass reddens the failed-pass case,
 *    and leaving `appliedKey` as it was during the pass reddens the unticked
 *    one after it;
 *  - letting the publisher button run during a conversion reddens the case
 *    that holds a pass open.
 */
import { formatFileSize } from '@shared/utils'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useSyncExternalStore } from 'react'
import { toast } from 'sonner'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ConverterSurface } from '../app/components/convert/converter-surface'
import {
	convertPairBySlug,
	USDZ_GLASS_NOTE
} from '../app/lib/convert/convert-pairs'

/* ------------------------------------------------------------------ *
 * A model context the test drives, rather than a value it fixes.
 * ------------------------------------------------------------------ */

interface LoaderFile {
	model: { name: string }
	name: string
	type: string
	sourcePackageBytes?: number
	sourceTextureBytes?: number
}

interface Pending {
	/** Puts the model on the stage, leaving `load` unresolved. */
	publish: (file: LoaderFile) => void
	resolve: (file: LoaderFile) => void
	reject: (error: { code: string; message: string }) => void
}

const listeners = new Set<() => void>()
let snapshot: Record<string, unknown> = {}
let loadCalls: File[][] = []
let pending: Pending[] = []

/*
  The token the real hook keeps. `stillCurrent` reads it rather than a captured
  boolean, and `reset` claims one too, which is what makes "the user cleared the
  model" and "a newer file replaced it" the same answer to a caller.
*/
let latestToken = 0

/*
  Which load's model is on the stage. Publishing moves it to that load; a
  refusal leaves it where it was and `reset` clears it, as in the real hook.
*/
let onScreen = 0

/*
  The document the optimizer holds: a load's, once that load settles, because
  the real loaders publish first and ingest after. Distinct per load, so a test
  can tell which model's document was read.
*/
let heldDocument: { name: string } | null = null

/** Every document an export or a handoff read, in order. */
let documentsRead: unknown[] = []

/* The last model on the stage, which a refused load puts back. */
let lastReady: LoaderFile | null = null

/** Blocks every export until the test lets go, so a drop can land mid-encode. */
let exportBlock: Promise<void> | null = null
let releaseExport: () => void = () => undefined

function blockExports() {
	exportBlock = new Promise<void>((resolve) => {
		releaseExport = () => {
			exportBlock = null
			resolve()
		}
	})
}

const publish = (next: Record<string, unknown>) => {
	snapshot = { ...snapshot, ...next }
	for (const listener of listeners) listener()
}

/**
 * Resolves the load that is `index` in the order they were started.
 *
 * Out of order on purpose in the supersession cases: that is the whole
 * scenario, and it cannot be produced by awaiting them as they were made.
 */
const settle = (index: number, file: LoaderFile) =>
	pending[index]?.resolve(file)

/**
 * Puts a load's model on the stage without letting `load` resolve.
 *
 * This is the real gap, not a contrivance: the loaders publish as soon as they
 * have parsed and then await the optimizer ingest, so on a large model the
 * viewer changes seconds before `load` comes back. Everything the page prints
 * around the stage is written by the caller, and this is the only way to ask
 * what it says while the two disagree.
 */
const reachStage = (index: number, file: LoaderFile) =>
	pending[index]?.publish(file)

/**
 * Refuses the load that is `index`, the way the hook does: the model already on
 * screen is left exactly where it is, and only the outcome carries the failure.
 */
const refuse = (index: number, code = 'unsupported_format') =>
	pending[index]?.reject({ code, message: 'nope' })

const exported = {
	data: new Uint8Array(0),
	transmissiveMaterials: [] as string[]
}

/** Blocks the WebP pass, the slowest thing a conversion does. */
let passBlock: Promise<void> | null = null
let releasePass: () => void = () => undefined

function blockPasses() {
	passBlock = new Promise<void>((resolve) => {
		releasePass = () => {
			passBlock = null
			resolve()
		}
	})
}

const optimizer = {
	/*
	  A spy, not a plain arrow. Whether the optimizer is read *at all* after a
	  newer drop is the assertion for the guard in front of it - `store`'s own
	  guard keeps the wrong bytes off the page but cannot say the encode was
	  skipped.
	*/
	_getDocument: vi.fn(() => heldDocument),
	texturesOptimization: vi.fn(async () => {
		if (passBlock) await passBlock
	})
}

function resetContext() {
	listeners.clear()
	loadCalls = []
	pending = []
	snapshot = {
		status: 'empty',
		file: null,
		progress: 0,
		optimizer,
		reset: () => {
			latestToken += 1
			onScreen = 0
			lastReady = null
			publish({ status: 'empty', file: null })
		},
		load: (
			source: { files: File[] },
			options?: { onPublish?: (outcome: Record<string, unknown>) => void }
		) => {
			loadCalls.push(source.files)

			const token = ++latestToken
			const stillCurrent = () => latestToken === token
			const stillOnScreen = () => onScreen === token

			/* Every load blanks the stage on the way in, as the hook's does. */
			publish({ status: 'loading', file: null })

			return new Promise((resolve) => {
				const reachStage = (file: LoaderFile) => {
					/*
					  Committed only while current: that asymmetry is the contract,
					  and it is the whole reason the caller needs `stillCurrent`
					  rather than reading `status`.
					*/
					if (!stillCurrent()) return
					onScreen = token
					lastReady = file
					publish({ status: 'ready', file })
					options?.onPublish?.({
						status: 'ready',
						file,
						error: null,
						stillCurrent,
						stillOnScreen
					})
				}

				pending.push({
					publish: reachStage,
					resolve: (file) => {
						/*
						  Publishing happens before the promise settles, the way the
						  real hook does, which is why the Convert button can render
						  before the drop that produced it has finished adopting.
						*/
						reachStage(file)
						if (stillOnScreen()) heldDocument = { name: file.name }
						resolve({
							status: 'ready',
							file,
							error: null,
							stillCurrent,
							stillOnScreen
						})
					},
					reject: (error) => {
						/* A refused upload puts back whatever was on the stage. */
						if (stillCurrent()) {
							publish(
								lastReady
									? { status: 'ready', file: lastReady }
									: { status: 'error', file: null }
							)
						}
						resolve({
							status: 'error',
							file: null,
							error,
							stillCurrent,
							stillOnScreen
						})
					}
				})
			})
		}
	}
}

vi.mock('@vctrl/hooks/use-load-model', () => ({
	useModelContext: () =>
		useSyncExternalStore(
			(listener: () => void) => {
				listeners.add(listener)
				return () => listeners.delete(listener)
			},
			() => snapshot,
			() => snapshot
		)
}))

vi.mock('../app/components/viewer/client-vectreal-viewer', () => ({
	ClientVectrealViewer: ({ model }: { model: { name: string } }) => (
		<div data-testid="stage" data-model={model?.name} />
	)
}))

vi.mock('@vctrl/core/model-exporter', () => ({
	ModelExporter: class {
		async exportDocumentGLB(document: unknown) {
			documentsRead.push(document)
			if (exportBlock) await exportBlock
			return exported
		}
		async exportDocumentGLBDraco() {
			return exported
		}
		async exportDocumentGLTF() {
			return exported
		}
		async exportThreeJSUSDZ() {
			return exported
		}
		async createZIPArchive() {
			return exported.data
		}
	}
}))

/*
  Analytics are off unless a test turns them on, as a visitor who ignored the
  banner has them. The capture spy is shared, and cleared before each test.
*/
const { capture, consentState } = vi.hoisted(() => ({
	capture: vi.fn(),
	consentState: { analytics: false }
}))
vi.mock('posthog-js/react', () => ({ usePostHog: () => ({ capture }) }))

vi.mock('../app/components/consent/consent-context', () => ({
	useConsent: () => ({ consent: consentState })
}))

const navigated: string[] = []
vi.mock('react-router', () => ({
	useNavigate: () => async (to: string) => {
		navigated.push(to)
	}
}))

/** Holds the publisher handoff open, the way a large document would. */
let draftBlock: Promise<void> | null = null
let releaseDraft: () => void = () => undefined

function blockDraft() {
	draftBlock = new Promise<void>((resolve) => {
		releaseDraft = () => {
			draftBlock = null
			resolve()
		}
	})
}

vi.mock('../app/lib/domain/scene/client/scene-draft-persistence', () => ({
	persistPendingSceneDraftOrchestrator: async ({
		prepareGltfDocumentForUpload
	}: {
		prepareGltfDocumentForUpload: () => Promise<unknown>
	}) => {
		await prepareGltfDocumentForUpload()
		if (draftBlock) await draftBlock
		return 'draft-1'
	}
}))

/* Serializes whatever the optimizer holds, as the real one does. */
vi.mock('../app/hooks/scene-loader/use-scene-document-export', () => ({
	usePrepareGltfDocument: () => async () => {
		documentsRead.push(heldDocument)
		return { data: {}, assets: new Map() }
	}
}))

/** Holds a sample's download open until a test lets it finish. */
let sampleBlock: Promise<void> | null = null

vi.mock('../app/lib/samples/sample-models', () => ({
	sampleModelById: (id: string) =>
		id === 'rocket' ? { id: 'rocket', label: 'Rocket', bytes: 1 } : null,
	fetchSampleModel: async () => {
		if (sampleBlock) await sampleBlock
		return new File([''], 'sample.glb')
	}
}))

/* A probe for what the page hands the tiles: which sample, if any, is on its way down. */
vi.mock('../app/components/layout-components/sample-tiles', () => ({
	SampleTiles: (props: {
		onOpen: (id: string) => void
		download?: { id: string } | null
	}) => (
		<button
			type="button"
			data-downloading={props.download?.id ?? ''}
			onClick={() => props.onOpen('rocket')}
		>
			sample
		</button>
	)
}))

/*
  The image formats this browser's canvas can write. Every browser the other
  cases describe writes WebP; the Safari case takes it away.
*/
const writableFormats = vi.hoisted(() => new Set(['webp', 'jpeg', 'png']))
vi.mock('@vctrl/hooks/use-optimize-model', () => ({
	canEncodeImage: async (format: string) => writableFormats.has(format)
}))

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

vi.mock('file-saver', () => ({ default: { saveAs: vi.fn() } }))

/* ------------------------------------------------------------------ *
 * Driving the page
 * ------------------------------------------------------------------ */

const gltfToGlb = convertPairBySlug('gltf-to-glb')!

function gltfFile(name = 'chair.gltf', bytes = 1_000) {
	return new File([new Uint8Array(bytes)], name, { type: 'model/gltf+json' })
}

function drop(files: File[]) {
	const zone = screen.getByLabelText(/converter$/i)

	fireEvent.drop(zone, {
		dataTransfer: {
			files,
			items: files.map((file) => ({
				kind: 'file',
				type: file.type,
				getAsFile: () => file
			})),
			types: ['Files']
		}
	})
}

const convertButton = () => screen.getByRole('button', { name: /^Convert to/ })

/** One turn of the event loop: long enough for every microtask a click starts. */
const yieldToPage = () => new Promise((resolve) => setTimeout(resolve, 0))

function loadedFile(over: Partial<LoaderFile> = {}): LoaderFile {
	return {
		model: { name: 'chair' },
		name: 'chair.gltf',
		type: 'gltf',
		...over
	}
}

beforeEach(() => {
	// jsdom has none. The stage's animated height needs one, and nothing here reads it.
	vi.stubGlobal(
		'ResizeObserver',
		class {
			observe() {}
			disconnect() {}
		}
	)
	exported.data = new Uint8Array(0)
	exported.transmissiveMaterials = []
	exportBlock = null
	passBlock = null
	latestToken = 0
	onScreen = 0
	heldDocument = null
	documentsRead = []
	lastReady = null
	draftBlock = null
	sampleBlock = null
	navigated.length = 0
	optimizer.texturesOptimization.mockClear()
	optimizer._getDocument.mockClear()
	/*
	  The toast spies are module-level and were never cleared, so a message
	  raised by one test still satisfied `toHaveBeenCalledWith` in the next. Two
	  mutations survived on that alone - the assertion was reading another test's
	  output.
	*/
	vi.mocked(toast.error).mockClear()
	vi.mocked(toast.success).mockClear()
	capture.mockClear()
	consentState.analytics = false
	writableFormats.add('webp')
	resetContext()
})

describe('an option the browser cannot carry out is not offered', () => {
	it('leaves WebP out where the canvas cannot write it', async () => {
		/*
		  THE DEFECT: WebKit cannot encode WebP and hands back a PNG instead of
		  failing. Ticking this box on Safari turned the camera sample's 18 MB of
		  JPEG textures into 190 MB of PNG filed as WebP, and the tab crashed.
		  The encoder refuses now, so offering the box would promise a pass that
		  can only fail.
		*/
		writableFormats.delete('webp')
		render(<ConverterSurface pair={gltfToGlb} />)

		drop([gltfFile()])
		await waitFor(() => expect(loadCalls).toHaveLength(1))
		settle(0, loadedFile())
		await screen.findByTestId('stage')

		expect(screen.getByRole('checkbox', { name: /Draco/i })).toBeTruthy()
		expect(screen.queryByRole('checkbox', { name: /WebP/i })).toBeNull()
	})
})

describe('a sample on its way down', () => {
	it('tells the tiles which sample is downloading', async () => {
		let release = () => {}
		sampleBlock = new Promise<void>((resolve) => (release = resolve))
		render(<ConverterSurface pair={convertPairBySlug('glb-to-gltf')!} />)
		const tiles = screen.getByRole('button', { name: 'sample' })

		fireEvent.click(tiles)

		await waitFor(() =>
			expect(tiles.getAttribute('data-downloading')).toBe('rocket')
		)
		release()
	})
})

describe('the size a conversion is measured against', () => {
	it('is the package the loader measured, with its textures counted once', async () => {
		/*
		  THE DEFECT: `sourceTextureBytes` is a breakdown of `sourcePackageBytes`,
		  not a second figure to add to it, so adding them counted every texture
		  twice. A 5.2 MB folder reported 8.2 MB, and a 4.5 MB result then claimed
		  45% saved where the truth was 13% - on the one number the page exists to
		  show, in the direction that flatters us.

		  The numbers below are that example, so the two candidate answers are far
		  enough apart that no rounding can confuse them.
		*/
		render(<ConverterSurface pair={gltfToGlb} />)

		drop([gltfFile()])
		await waitFor(() => expect(loadCalls).toHaveLength(1))

		settle(
			0,
			loadedFile({
				sourcePackageBytes: 5_200_000,
				sourceTextureBytes: 3_000_000
			})
		)
		await screen.findByTestId('stage')

		exported.data = new Uint8Array(4_500_000)
		fireEvent.click(convertButton())

		/*
		  `findByText` already throws when the figure is absent, so a
		  `toBeTruthy` on its result cannot fail and was doing no work. The same
		  wrapper was left on three other queries in this file and has gone from
		  all of them.

		  The two lines below are one assertion in two halves, and the first is
		  the one that fires: under the gate the page prints 8.2 MB, so
		  `findByText` fails looking for 5.2 MB before the `toBeNull` is reached.
		  The second is kept because it names the wrong figure, which is what
		  makes the failure legible - not because it can fail alone.
		*/
		await screen.findByText(formatFileSize(5_200_000))
		expect(screen.queryByText(formatFileSize(8_200_000))).toBeNull()
	})

	it('falls back to the selection when the loader measured nothing', async () => {
		/* A bridged source (OBJ, STL, FBX) reports neither figure. */
		render(<ConverterSurface pair={gltfToGlb} />)

		drop([gltfFile('chair.gltf', 4_096)])
		await waitFor(() => expect(loadCalls).toHaveLength(1))

		settle(0, loadedFile())
		await screen.findByTestId('stage')

		exported.data = new Uint8Array(2_048)
		fireEvent.click(convertButton())

		await screen.findByText(formatFileSize(4_096))
	})
})

describe('a document that was just read is not read again', () => {
	it('converts without a second load when no option is ticked', async () => {
		/*
		  THE DEFECT: `adoptSource` said `appliedKey.current = null`, meaning
		  "unknown", for a document the loader had just finished reading. `prepare`
		  compares that against the empty recipe, never matches, and re-read the
		  file - unmounting the viewer and spinning for seconds on work already
		  done. Every first conversion, including on the pages that offer no
		  options at all.

		  Asserted as the count of loads rather than as a spinner, because the
		  spinner is the symptom and the second read is the defect.
		*/
		render(<ConverterSurface pair={gltfToGlb} />)

		drop([gltfFile()])
		await waitFor(() => expect(loadCalls).toHaveLength(1))

		settle(0, loadedFile({ sourcePackageBytes: 1_000 }))
		await screen.findByTestId('stage')

		exported.data = new Uint8Array(900)
		fireEvent.click(convertButton())

		await screen.findByText(formatFileSize(900))
		expect(loadCalls).toHaveLength(1)
		expect(screen.getByTestId('stage').dataset.model).toBe('chair')
	})
})

describe('a USDZ result says when its glass was flattened', () => {
	/*
	  The stage keeps drawing the glass clear, so this line is the only place the
	  reader hears about it before Quick Look shows them.
	*/
	it.each([
		[['lens'], true],
		[[], false]
	])(
		'with transmissive materials %j, says so: %s',
		async (transmissiveMaterials, expected) => {
			render(<ConverterSurface pair={convertPairBySlug('gltf-to-usdz')!} />)

			drop([gltfFile()])
			await waitFor(() => expect(loadCalls).toHaveLength(1))
			settle(0, loadedFile({ sourcePackageBytes: 1_000 }))
			await screen.findByTestId('stage')

			exported.data = new Uint8Array(900)
			exported.transmissiveMaterials = transmissiveMaterials
			fireEvent.click(convertButton())
			await screen.findByText(formatFileSize(900))

			expect(screen.queryByText(USDZ_GLASS_NOTE) !== null).toBe(expected)
		}
	)
})

describe('a load that lost does not describe the page', () => {
	it('adopts the file that won, not the one that resolved last', async () => {
		/*
		  THE DEFECT: `load` retires a superseded load's state but hands its
		  caller a `ready` state byte-identical to the winner's, so the surface
		  ran a counter of its own to tell them apart - and `prepare`'s own reload
		  took a loader token without moving that counter, so a retired drop
		  adopted anyway. End state: model B on the stage, model A's bytes and
		  name in `source`.

		  The two sizes are far apart so the figure alone identifies which one
		  the page decided it was about.
		*/
		render(<ConverterSurface pair={gltfToGlb} />)

		/*
		  One at a time through the dropzone, which resolves the selection
		  asynchronously: firing both in a tick drops the second on the floor
		  here, and that is a property of the test harness rather than of the
		  page. The overlap the case is about is in the *loads*, and neither has
		  been settled yet.
		*/
		drop([gltfFile('slow.gltf')])
		await waitFor(() => expect(loadCalls).toHaveLength(1))
		drop([gltfFile('fast.gltf')])
		await waitFor(() => expect(loadCalls).toHaveLength(2))

		/* The second drop wins, then the first one finally comes back. */
		settle(1, loadedFile({ name: 'fast.gltf', sourcePackageBytes: 1_000_000 }))
		settle(0, loadedFile({ name: 'slow.gltf', sourcePackageBytes: 9_000_000 }))
		await screen.findByTestId('stage')

		exported.data = new Uint8Array(500_000)
		fireEvent.click(convertButton())

		await screen.findByText(formatFileSize(1_000_000))
		expect(screen.queryByText(formatFileSize(9_000_000))).toBeNull()
	})

	it('does not file a conversion the reader has already replaced', async () => {
		/*
		  THE DEFECT: all three writers sit after an export await and wrote with
		  render-closure captures, unguarded. A conversion of file A finishing
		  after file B landed filed A's bytes under A's name into the map the
		  panel reads for B - so the download was one model and every figure
		  printed beside it was another.

		  Blocking the export is the only way to hold the window open; in the
		  product it is however long a 13 MB GLB takes to write.
		*/
		render(<ConverterSurface pair={gltfToGlb} />)

		drop([gltfFile('first.gltf')])
		await waitFor(() => expect(loadCalls).toHaveLength(1))
		settle(0, loadedFile({ name: 'first.gltf', sourcePackageBytes: 9_000_000 }))
		await screen.findByTestId('stage')

		blockExports()
		exported.data = new Uint8Array(500_000)
		fireEvent.click(convertButton())

		/* A second file lands while the first conversion is still encoding. */
		drop([gltfFile('second.gltf')])
		await waitFor(() => expect(loadCalls).toHaveLength(2))
		settle(
			1,
			loadedFile({ name: 'second.gltf', sourcePackageBytes: 2_000_000 })
		)

		releaseExport()

		await waitFor(() => expect(screen.getByText(/second\.gltf/)).toBeTruthy())
		expect(screen.queryByRole('button', { name: /^Download/ })).toBeNull()
	})
})

describe('a refused drop does not retire the model it left on screen', () => {
	it('still converts the model on the stage after a refusal', async () => {
		/*
		  THE DEFECT: the loader claims a fresh token for every attempt, including
		  one that fails and deliberately leaves the previous model rendered. That
		  retired the predicate `adoptSource` recorded for a model still on the
		  stage, and `store` is guarded by it - so the conversion ran to
		  completion and was thrown away with nothing said.

		  Deterministic, not a race: no overlap, no timing. Drop a file that is
		  not a model onto an open one, press Convert, and the spinner finishes
		  onto an empty panel. With no option ticked `prepare` returns early and
		  never rewrites the predicate, so it never repairs itself either.
		*/
		render(<ConverterSurface pair={gltfToGlb} />)

		drop([gltfFile('chair.gltf')])
		await waitFor(() => expect(loadCalls).toHaveLength(1))
		settle(0, loadedFile({ name: 'chair.gltf', sourcePackageBytes: 900 }))
		await screen.findByTestId('stage')

		drop([new File(['x'], 'notes.txt')])
		await waitFor(() => expect(loadCalls).toHaveLength(2))
		refuse(1)
		await screen.findByRole('alert')

		exported.data = new Uint8Array(400)
		fireEvent.click(convertButton())

		expect(
			await screen.findByRole('button', { name: /^Download/ })
		).toBeTruthy()
	})
})

describe('a destructive pass is not credited to a document that never had it', () => {
	it('abandons a re-read that a newer file replaced before the pass began', async () => {
		/*
		  The other half of the bracket. `prepare` re-reads the source and only
		  then decides whether to apply a destructive pass, so a file landing
		  inside the re-read leaves that resolution describing the model on its
		  way out. Running the pass for it re-encodes the wrong document and
		  writes the recipe down against the new one.

		  The re-read is settled *after* the drop that replaces it, which is the
		  whole scenario and cannot be produced by settling in order.
		*/
		render(<ConverterSurface pair={gltfToGlb} />)

		drop([gltfFile('first.gltf')])
		await waitFor(() => expect(loadCalls).toHaveLength(1))
		settle(0, loadedFile({ name: 'first.gltf', sourcePackageBytes: 9_000_000 }))
		await screen.findByTestId('stage')

		fireEvent.click(screen.getByRole('checkbox', { name: /WebP/i }))
		fireEvent.click(convertButton())
		await waitFor(() => expect(loadCalls).toHaveLength(2))

		/* A second file lands while the re-read is still outstanding. */
		drop([gltfFile('second.gltf')])
		await waitFor(() => expect(loadCalls).toHaveLength(3))
		settle(
			2,
			loadedFile({ name: 'second.gltf', sourcePackageBytes: 2_000_000 })
		)
		await waitFor(() => expect(screen.getByText(/second\.gltf/)).toBeTruthy())

		/* Only now does the re-read of the replaced file come back. */
		settle(1, loadedFile({ name: 'first.gltf', sourcePackageBytes: 9_000_000 }))
		await waitFor(() => expect(screen.getByText(/second\.gltf/)).toBeTruthy())

		expect(optimizer.texturesOptimization).not.toHaveBeenCalled()
	})

	it('re-runs the WebP pass when a newer file landed during the last one', async () => {
		/*
		  THE DEFECT: the currency check sat immediately after the re-read and was
		  not repeated after `texturesOptimization` - which re-encodes every
		  texture and is the slowest thing this page does, so it is the easiest
		  window for a second file to land in. The write below it tells the next
		  Convert that the document already has the pass, so the new model's
		  untouched textures went out under a ticked box.

		  Asserted through the pass count rather than through the ref: what the
		  reader would see is a second conversion that quietly skips the work,
		  and that is exactly what the count measures.
		*/
		render(<ConverterSurface pair={gltfToGlb} />)

		drop([gltfFile('first.gltf')])
		await waitFor(() => expect(loadCalls).toHaveLength(1))
		settle(0, loadedFile({ name: 'first.gltf', sourcePackageBytes: 9_000_000 }))
		await screen.findByTestId('stage')

		fireEvent.click(screen.getByRole('checkbox', { name: /WebP/i }))

		blockPasses()
		fireEvent.click(convertButton())

		/* `prepare` re-reads the source before it may apply a destructive pass. */
		await waitFor(() => expect(loadCalls).toHaveLength(2))
		settle(1, loadedFile({ name: 'first.gltf', sourcePackageBytes: 9_000_000 }))
		await waitFor(() =>
			expect(optimizer.texturesOptimization).toHaveBeenCalledTimes(1)
		)

		/* A second file arrives while those textures are still being encoded. */
		drop([gltfFile('second.gltf')])
		await waitFor(() => expect(loadCalls).toHaveLength(3))
		settle(
			2,
			loadedFile({ name: 'second.gltf', sourcePackageBytes: 2_000_000 })
		)
		await waitFor(() => expect(screen.getByText(/second\.gltf/)).toBeTruthy())

		/*
		  Let the interrupted run finish and try to file its result.

		  This waited on the Download button being absent, which passed on entry
		  - `adoptSource` had already cleared the conversions - so it asserted
		  nothing. It was still load-bearing, because `waitFor` yields to the
		  event loop and the interrupted run needs that to unwind before the
		  click below. Keeping the yield and giving it something true to check:
		  releasing a superseded pass must not start another one.
		*/
		releasePass()
		await waitFor(() =>
			expect(optimizer.texturesOptimization).toHaveBeenCalledTimes(1)
		)

		/*
		  Converting the new model must do the work again. If the interrupted run
		  had been allowed to write its recipe down, this takes the early return
		  and the count stays at one.
		*/
		exported.data = new Uint8Array(1_000_000)
		fireEvent.click(convertButton())
		await waitFor(() => expect(loadCalls).toHaveLength(4))
		settle(
			3,
			loadedFile({ name: 'second.gltf', sourcePackageBytes: 2_000_000 })
		)

		await waitFor(() =>
			expect(optimizer.texturesOptimization).toHaveBeenCalledTimes(2)
		)
	})
})

describe('the page describes the model that is on the stage', () => {
	it('moves the figures with the viewer, not an ingest later', async () => {
		/*
		  THE DEFECT. The loader publishes as soon as it has parsed and then awaits
		  the optimizer ingest, while the surface adopted only once `load`
		  resolved. Between the two the stage showed the new model and every figure
		  around it - the byte count, the size comparison, a live Download button -
		  still described the old one. On a large model that window is seconds, and
		  `stillCurrent()` cannot close it: inside it the new load genuinely is the
		  current one.

		  `reachStage` is exactly that window: published, not resolved.
		*/
		render(<ConverterSurface pair={gltfToGlb} />)

		drop([gltfFile()])
		await waitFor(() => expect(loadCalls).toHaveLength(1))
		settle(0, loadedFile({ sourcePackageBytes: 5_200_000 }))

		/*
		  Read off the row rather than with `findByText`. Before a conversion
		  exists the size is a sibling text node of the name inside one paragraph,
		  so no single element holds it on its own - which is also why the name and
		  the size are asserted together here: they are one claim about one file,
		  and the defect is that they disagree.
		*/
		const fileRow = async (name: string) =>
			(await screen.findByText(name)).closest('p')!

		expect((await fileRow('chair.gltf')).textContent).toContain(
			formatFileSize(5_200_000)
		)

		drop([gltfFile('second.gltf')])
		await waitFor(() => expect(loadCalls).toHaveLength(2))
		reachStage(
			1,
			loadedFile({ name: 'second.gltf', sourcePackageBytes: 1_000 })
		)

		const row = await fileRow('second.gltf')
		await waitFor(() =>
			expect(row.textContent).toContain(formatFileSize(1_000))
		)
		expect(row.textContent).not.toContain(formatFileSize(5_200_000))
	})

	it('says so when a finished conversion is filed too late', async () => {
		/*
		  `store` declining used to be a bare `return`, while the same event on
		  the `prepare` path raised a toast. The visitor watched the spinner run to
		  the end and produce no download, with nothing said about why.
		*/
		render(<ConverterSurface pair={gltfToGlb} />)

		drop([gltfFile()])
		await waitFor(() => expect(loadCalls).toHaveLength(1))
		settle(0, loadedFile({ sourcePackageBytes: 2_000_000 }))
		await screen.findByTestId('stage')

		blockExports()
		exported.data = new Uint8Array(1_000)
		fireEvent.click(convertButton())

		// A newer file lands while the encode is still running.
		drop([gltfFile('second.gltf')])
		await waitFor(() => expect(loadCalls).toHaveLength(2))
		settle(1, loadedFile({ name: 'second.gltf', sourcePackageBytes: 3_000 }))

		releaseExport()

		await waitFor(() =>
			expect(toast.error).toHaveBeenCalledWith(
				'A newer file replaced that one. Press Convert again.'
			)
		)
	})

	it('does not read the optimizer for a model that has been replaced', async () => {
		/*
		  `_getDocument()` hands back whatever the optimizer holds *now*, which
		  after a newer drop is the new model - so a conversion that reached it
		  late would encode the new model's bytes under the old model's name.

		  What stops that is `prepare`, which asks about currency again after the
		  texture pass and returns null, so the encode is never begun. This pins
		  that: removing that second check reddens this case. A guard in front of
		  the read here was written and removed instead of kept - no mutation
		  could redden a test for it, because `prepare` covers every path that
		  reaches it.
		*/
		render(<ConverterSurface pair={gltfToGlb} />)

		drop([gltfFile()])
		await waitFor(() => expect(loadCalls).toHaveLength(1))
		settle(0, loadedFile({ sourcePackageBytes: 2_000_000 }))
		await screen.findByTestId('stage')

		/*
		  A pass has to be ticked for there to be a slow await to land inside, and
		  ticking one makes Convert re-read the document first - so the pass only
		  starts once that re-read settles.
		*/
		fireEvent.click(screen.getByRole('checkbox', { name: /WebP/i }))

		blockPasses()
		fireEvent.click(convertButton())
		await waitFor(() => expect(loadCalls).toHaveLength(2))
		settle(1, loadedFile({ sourcePackageBytes: 2_000_000 }))
		await waitFor(() =>
			expect(optimizer.texturesOptimization).toHaveBeenCalledTimes(1)
		)

		drop([gltfFile('second.gltf')])
		await waitFor(() => expect(loadCalls).toHaveLength(3))
		settle(2, loadedFile({ name: 'second.gltf', sourcePackageBytes: 3_000 }))

		optimizer._getDocument.mockClear()
		releasePass()

		await waitFor(() =>
			expect(toast.error).toHaveBeenCalledWith(
				'A newer file replaced that one. Press Convert again.'
			)
		)
		expect(optimizer._getDocument).not.toHaveBeenCalled()
	})
})

describe('the optimizer is read only for the model it holds', () => {
	/*
	  THE DEFECT. The page adopts a model the moment it reaches the stage, but
	  the optimizer ingests it only after that, so for as long as the ingest takes
	  the optimizer still holds the previous model's document. A Convert pressed
	  in that window exported it under the new file's name, with no box ticked.

	  `reachStage` is that window: published, not settled.
	*/
	it('waits for the first model to be read before converting it', async () => {
		render(<ConverterSurface pair={gltfToGlb} />)

		drop([gltfFile()])
		await waitFor(() => expect(loadCalls).toHaveLength(1))
		reachStage(0, loadedFile({ sourcePackageBytes: 2_000_000 }))
		await screen.findByTestId('stage')

		exported.data = new Uint8Array(1_000)
		fireEvent.click(convertButton())
		await yieldToPage()
		expect(toast.error).not.toHaveBeenCalled()

		settle(0, loadedFile({ sourcePackageBytes: 2_000_000 }))

		expect(
			await screen.findByRole('button', { name: /^Download/ })
		).toBeTruthy()
		expect(documentsRead).toEqual([{ name: 'chair.gltf' }])
		expect(toast.error).not.toHaveBeenCalled()
	})

	it('never exports the previous model for a file still being read', async () => {
		render(<ConverterSurface pair={gltfToGlb} />)

		drop([gltfFile('first.gltf')])
		await waitFor(() => expect(loadCalls).toHaveLength(1))
		settle(0, loadedFile({ name: 'first.gltf', sourcePackageBytes: 9_000 }))
		await screen.findByTestId('stage')

		drop([gltfFile('second.gltf')])
		await waitFor(() => expect(loadCalls).toHaveLength(2))
		reachStage(
			1,
			loadedFile({ name: 'second.gltf', sourcePackageBytes: 2_000 })
		)
		await waitFor(() => expect(screen.getByText(/second\.gltf/)).toBeTruthy())

		fireEvent.click(convertButton())
		await yieldToPage()
		expect(documentsRead).toEqual([])

		settle(1, loadedFile({ name: 'second.gltf', sourcePackageBytes: 2_000 }))

		expect(
			await screen.findByRole('button', { name: /^Download/ })
		).toBeTruthy()
		expect(documentsRead).toEqual([{ name: 'second.gltf' }])
	})

	/*
	  The wait can end on a different model: one dropped and shown while it
	  waited. The conversion was for the model the button was pressed under,
	  so it stops rather than export the newer one under the older one's name.
	*/
	it('abandons a Convert whose model was replaced while it waited', async () => {
		render(<ConverterSurface pair={gltfToGlb} />)

		drop([gltfFile('first.gltf')])
		await waitFor(() => expect(loadCalls).toHaveLength(1))
		reachStage(0, loadedFile({ name: 'first.gltf', sourcePackageBytes: 9_000 }))
		await screen.findByTestId('stage')

		fireEvent.click(convertButton())
		await yieldToPage()

		drop([gltfFile('second.gltf')])
		await waitFor(() => expect(loadCalls).toHaveLength(2))
		settle(1, loadedFile({ name: 'second.gltf', sourcePackageBytes: 2_000 }))
		await waitFor(() => expect(screen.getByText(/second\.gltf/)).toBeTruthy())
		settle(0, loadedFile({ name: 'first.gltf', sourcePackageBytes: 9_000 }))

		await waitFor(() =>
			expect(toast.error).toHaveBeenCalledWith(
				'A newer file replaced that one. Press Convert again.'
			)
		)
		expect(documentsRead).toEqual([])
	})

	/*
	  A refused drop never reaches the stage, so it cannot stand in for the
	  ingest of the model that is there. Waiting on the newest load instead
	  waited on a refusal that had already settled.
	*/
	it('still waits for the model on the stage after a refused drop', async () => {
		render(<ConverterSurface pair={gltfToGlb} />)

		drop([gltfFile('first.gltf')])
		await waitFor(() => expect(loadCalls).toHaveLength(1))
		settle(0, loadedFile({ name: 'first.gltf', sourcePackageBytes: 9_000 }))
		await screen.findByTestId('stage')

		drop([gltfFile('second.gltf')])
		await waitFor(() => expect(loadCalls).toHaveLength(2))
		reachStage(
			1,
			loadedFile({ name: 'second.gltf', sourcePackageBytes: 2_000 })
		)
		drop([new File(['x'], 'notes.txt')])
		await waitFor(() => expect(loadCalls).toHaveLength(3))
		refuse(2)
		await screen.findByRole('alert')

		fireEvent.click(convertButton())
		await yieldToPage()
		expect(documentsRead).toEqual([])

		settle(1, loadedFile({ name: 'second.gltf', sourcePackageBytes: 2_000 }))
		expect(
			await screen.findByRole('button', { name: /^Download/ })
		).toBeTruthy()
		expect(documentsRead).toEqual([{ name: 'second.gltf' }])
	})

	/*
	  A refused drop is the newest load but leaves the model on the stage, so a
	  conversion running through one is still about the model on screen. Asked
	  as "is it the newest load", it was thrown away with a message about a
	  newer file that did not exist.
	*/
	it('still files a conversion a refused drop ran through', async () => {
		render(<ConverterSurface pair={gltfToGlb} />)

		drop([gltfFile()])
		await waitFor(() => expect(loadCalls).toHaveLength(1))
		settle(0, loadedFile({ sourcePackageBytes: 2_000_000 }))
		await screen.findByTestId('stage')

		blockExports()
		exported.data = new Uint8Array(1_000)
		fireEvent.click(convertButton())
		await waitFor(() => expect(documentsRead).toHaveLength(1))

		drop([new File(['x'], 'notes.txt')])
		await waitFor(() => expect(loadCalls).toHaveLength(2))
		refuse(1)
		await screen.findByRole('alert')

		releaseExport()

		expect(
			await screen.findByRole('button', { name: /^Download/ })
		).toBeTruthy()
		expect(toast.error).not.toHaveBeenCalled()
	})
})

describe('a refused drop does not retire a model a WebP pass re-read', () => {
	/*
	  A WebP Convert re-reads the source, so the model on the stage then belongs
	  to that re-read. A refusal after it, or during its pass, leaves that model
	  on screen and in the optimizer, so neither may be treated as replaced.
	*/
	const convertWithWebp = async (passes: number) => {
		fireEvent.click(convertButton())
		await waitFor(() => expect(loadCalls).toHaveLength(passes + 1))
		settle(passes, loadedFile({ sourcePackageBytes: 2_000_000 }))
	}

	const refuseANote = async (loads: number) => {
		drop([new File(['x'], 'notes.txt')])
		await waitFor(() => expect(loadCalls).toHaveLength(loads))
		refuse(loads - 1)
		await screen.findByRole('alert')
	}

	it('keeps a pass a refused drop landed in', async () => {
		render(<ConverterSurface pair={gltfToGlb} />)

		drop([gltfFile()])
		await waitFor(() => expect(loadCalls).toHaveLength(1))
		settle(0, loadedFile({ sourcePackageBytes: 2_000_000 }))
		await screen.findByTestId('stage')
		fireEvent.click(screen.getByRole('checkbox', { name: /WebP/i }))

		blockPasses()
		await convertWithWebp(1)
		await waitFor(() =>
			expect(optimizer.texturesOptimization).toHaveBeenCalledTimes(1)
		)
		await refuseANote(3)
		releasePass()

		expect(
			await screen.findByRole('button', { name: /^Download/ })
		).toBeTruthy()
		expect(toast.error).not.toHaveBeenCalled()
	})

	it('says when the re-read itself failed', async () => {
		render(<ConverterSurface pair={gltfToGlb} />)

		drop([gltfFile()])
		await waitFor(() => expect(loadCalls).toHaveLength(1))
		settle(0, loadedFile({ sourcePackageBytes: 2_000_000 }))
		await screen.findByTestId('stage')
		fireEvent.click(screen.getByRole('checkbox', { name: /WebP/i }))

		fireEvent.click(convertButton())
		await waitFor(() => expect(loadCalls).toHaveLength(2))
		refuse(1)

		await waitFor(() =>
			expect(toast.error).toHaveBeenCalledWith(
				'That file could not be read again to apply those options. Untick them to download it as it is.'
			)
		)
	})

	it('names the newer file, not the re-read, when a newer file replaced it', async () => {
		render(<ConverterSurface pair={gltfToGlb} />)

		drop([gltfFile()])
		await waitFor(() => expect(loadCalls).toHaveLength(1))
		settle(0, loadedFile({ sourcePackageBytes: 2_000_000 }))
		await screen.findByTestId('stage')
		fireEvent.click(screen.getByRole('checkbox', { name: /WebP/i }))

		fireEvent.click(convertButton())
		await waitFor(() => expect(loadCalls).toHaveLength(2))
		drop([gltfFile('second.gltf')])
		await waitFor(() => expect(loadCalls).toHaveLength(3))
		settle(2, loadedFile({ name: 'second.gltf', sourcePackageBytes: 3_000 }))
		refuse(1)

		await waitFor(() =>
			expect(toast.error).toHaveBeenCalledWith(
				'A newer file replaced that one. Press Convert again.'
			)
		)
		expect(toast.error).toHaveBeenCalledTimes(1)
	})

	it('keeps a re-read a refused drop landed in while it was being read', async () => {
		render(<ConverterSurface pair={gltfToGlb} />)

		drop([gltfFile()])
		await waitFor(() => expect(loadCalls).toHaveLength(1))
		settle(0, loadedFile({ sourcePackageBytes: 2_000_000 }))
		await screen.findByTestId('stage')
		fireEvent.click(screen.getByRole('checkbox', { name: /WebP/i }))

		fireEvent.click(convertButton())
		await waitFor(() => expect(loadCalls).toHaveLength(2))
		reachStage(1, loadedFile({ sourcePackageBytes: 2_000_000 }))
		await refuseANote(3)
		settle(1, loadedFile({ sourcePackageBytes: 2_000_000 }))

		expect(
			await screen.findByRole('button', { name: /^Download/ })
		).toBeTruthy()
		expect(toast.error).not.toHaveBeenCalled()
	})

	it('converts again after a pass that failed', async () => {
		render(<ConverterSurface pair={gltfToGlb} />)

		drop([gltfFile()])
		await waitFor(() => expect(loadCalls).toHaveLength(1))
		settle(0, loadedFile({ sourcePackageBytes: 2_000_000 }))
		await screen.findByTestId('stage')
		fireEvent.click(screen.getByRole('checkbox', { name: /WebP/i }))

		optimizer.texturesOptimization.mockRejectedValueOnce(
			new Error('No texture could be written.')
		)
		await convertWithWebp(1)
		await waitFor(() =>
			expect(toast.error).toHaveBeenCalledWith('No texture could be written.')
		)

		await convertWithWebp(2)

		expect(
			await screen.findByRole('button', { name: /^Download/ })
		).toBeTruthy()
		expect(toast.error).toHaveBeenCalledTimes(1)
	})

	it('reads the file again after a pass that failed, even unticked', async () => {
		render(<ConverterSurface pair={gltfToGlb} />)

		drop([gltfFile()])
		await waitFor(() => expect(loadCalls).toHaveLength(1))
		settle(0, loadedFile({ sourcePackageBytes: 2_000_000 }))
		await screen.findByTestId('stage')
		const webp = screen.getByRole('checkbox', { name: /WebP/i })
		fireEvent.click(webp)

		optimizer.texturesOptimization.mockRejectedValueOnce(
			new Error('No texture could be written.')
		)
		await convertWithWebp(1)
		await waitFor(() =>
			expect(toast.error).toHaveBeenCalledWith('No texture could be written.')
		)

		fireEvent.click(screen.getByRole('checkbox', { name: /WebP/i }))
		await convertWithWebp(2)

		expect(
			await screen.findByRole('button', { name: /^Download/ })
		).toBeTruthy()
		expect(loadCalls).toHaveLength(3)
	})

	// It serializes the document, which the pass is rewriting.
	it('cannot be handed to the publisher while a pass runs', async () => {
		render(<ConverterSurface pair={gltfToGlb} />)

		drop([gltfFile()])
		await waitFor(() => expect(loadCalls).toHaveLength(1))
		settle(0, loadedFile({ sourcePackageBytes: 2_000_000 }))
		await screen.findByTestId('stage')
		fireEvent.click(screen.getByRole('checkbox', { name: /WebP/i }))

		blockPasses()
		await convertWithWebp(1)
		await waitFor(() =>
			expect(optimizer.texturesOptimization).toHaveBeenCalledTimes(1)
		)

		expect(screen.getByRole('button', { name: /publisher/i })).toBeDisabled()
		releasePass()
		await screen.findByRole('button', { name: /^Download/ })
	})

	it('converts the re-read model again after a refusal', async () => {
		render(<ConverterSurface pair={gltfToGlb} />)

		drop([gltfFile()])
		await waitFor(() => expect(loadCalls).toHaveLength(1))
		settle(0, loadedFile({ sourcePackageBytes: 2_000_000 }))
		await screen.findByTestId('stage')
		fireEvent.click(screen.getByRole('checkbox', { name: /WebP/i }))

		await convertWithWebp(1)
		await screen.findByRole('button', { name: /^Download/ })

		await refuseANote(3)
		fireEvent.click(screen.getByRole('checkbox', { name: /Draco/i }))
		fireEvent.click(convertButton())

		await waitFor(() =>
			expect(screen.getAllByRole('button', { name: /^Download/ })).toHaveLength(
				1
			)
		)
		expect(toast.error).not.toHaveBeenCalled()
		expect(loadCalls).toHaveLength(3)
	})
})

describe('the handoff to the publisher', () => {
	const openButton = () => screen.getByRole('button', { name: /publisher/i })

	it('does not hand over a model the visitor has replaced', async () => {
		/*
		  `openInPublisher` consulted no currency at all: two awaits, and both the
		  file and the name it writes with are render-closure captures. A drop
		  landing in either gap wrote whatever the exporter found at that moment
		  into a draft named after the model the visitor had pressed the button
		  for.
		*/
		render(<ConverterSurface pair={gltfToGlb} />)

		drop([gltfFile()])
		await waitFor(() => expect(loadCalls).toHaveLength(1))
		settle(0, loadedFile({ sourcePackageBytes: 2_000_000 }))
		await screen.findByTestId('stage')

		blockDraft()
		fireEvent.click(openButton())

		drop([gltfFile('second.gltf')])
		await waitFor(() => expect(loadCalls).toHaveLength(2))
		settle(1, loadedFile({ name: 'second.gltf', sourcePackageBytes: 3_000 }))

		releaseDraft()

		await waitFor(() =>
			expect(toast.error).toHaveBeenCalledWith(
				'A newer file replaced that one. Press the button again.'
			)
		)
		expect(navigated).toEqual([])
	})

	it('hands over the model on the stage once the optimizer holds it', async () => {
		render(<ConverterSurface pair={gltfToGlb} />)

		drop([gltfFile('first.gltf')])
		await waitFor(() => expect(loadCalls).toHaveLength(1))
		settle(0, loadedFile({ name: 'first.gltf', sourcePackageBytes: 9_000 }))
		await screen.findByTestId('stage')

		drop([gltfFile('second.gltf')])
		await waitFor(() => expect(loadCalls).toHaveLength(2))
		reachStage(
			1,
			loadedFile({ name: 'second.gltf', sourcePackageBytes: 2_000 })
		)
		await waitFor(() => expect(screen.getByText(/second\.gltf/)).toBeTruthy())

		fireEvent.click(openButton())
		await yieldToPage()
		expect(documentsRead).toEqual([])

		settle(1, loadedFile({ name: 'second.gltf', sourcePackageBytes: 2_000 }))

		await waitFor(() => expect(navigated).toHaveLength(1))
		expect(documentsRead).toEqual([{ name: 'second.gltf' }])
	})

	it('does not hand over a model replaced while it waited', async () => {
		render(<ConverterSurface pair={gltfToGlb} />)

		drop([gltfFile('first.gltf')])
		await waitFor(() => expect(loadCalls).toHaveLength(1))
		reachStage(0, loadedFile({ name: 'first.gltf', sourcePackageBytes: 9_000 }))
		await screen.findByTestId('stage')

		fireEvent.click(openButton())
		await yieldToPage()

		drop([gltfFile('second.gltf')])
		await waitFor(() => expect(loadCalls).toHaveLength(2))
		settle(1, loadedFile({ name: 'second.gltf', sourcePackageBytes: 2_000 }))
		await waitFor(() => expect(screen.getByText(/second\.gltf/)).toBeTruthy())
		settle(0, loadedFile({ name: 'first.gltf', sourcePackageBytes: 9_000 }))

		await waitFor(() =>
			expect(toast.error).toHaveBeenCalledWith(
				'A newer file replaced that one. Press the button again.'
			)
		)
		expect(navigated).toEqual([])
	})

	it('cannot be cleared out from under itself', async () => {
		/*
		  "Convert another" clears the source the draft is being built from, and
		  was disabled during `isConverting` but not during `isHandingOff` - so it
		  was pressable in exactly the window where pressing it empties the model
		  mid-serialization.
		*/
		render(<ConverterSurface pair={gltfToGlb} />)

		drop([gltfFile()])
		await waitFor(() => expect(loadCalls).toHaveLength(1))
		settle(0, loadedFile({ sourcePackageBytes: 2_000_000 }))
		await screen.findByTestId('stage')

		blockDraft()
		fireEvent.click(openButton())

		const startOver = await screen.findByRole('button', {
			name: /convert another/i
		})
		await waitFor(() => expect(startOver).toBeDisabled())

		releaseDraft()
	})
})

describe('the funnel continues past arrival', () => {
	/*
	  Arrival was the only event, so the converter could say which formats
	  people brought and never whether they left with anything.
	*/
	const captured = (event: string) =>
		capture.mock.calls
			.filter(([name]) => name === event)
			.map(([, props]) => props)

	it('reports a finished conversion with its sizes', async () => {
		consentState.analytics = true
		render(<ConverterSurface pair={gltfToGlb} />)

		drop([gltfFile()])
		await waitFor(() => expect(loadCalls).toHaveLength(1))
		settle(0, loadedFile({ sourcePackageBytes: 5_200_000 }))
		await screen.findByTestId('stage')

		exported.data = new Uint8Array(4_500_000)
		fireEvent.click(convertButton())

		await waitFor(() =>
			expect(captured('convert_model_converted')).toEqual([
				expect.objectContaining({
					pair: 'gltf-to-glb',
					source_bytes: 5_200_000,
					result_bytes: 4_500_000
				})
			])
		)
	})

	it('reports the download, from the page it is saved on', async () => {
		consentState.analytics = true
		render(<ConverterSurface pair={gltfToGlb} />)

		drop([gltfFile()])
		await waitFor(() => expect(loadCalls).toHaveLength(1))
		settle(0, loadedFile({ sourcePackageBytes: 2_000_000 }))
		await screen.findByTestId('stage')

		exported.data = new Uint8Array(1_000_000)
		fireEvent.click(convertButton())
		fireEvent.click(await screen.findByRole('button', { name: /^Download/ }))

		expect(captured('convert_model_downloaded')).toEqual([
			expect.objectContaining({ pair: 'gltf-to-glb', result_bytes: 1_000_000 })
		])
	})

	it('does not count a conversion that a newer drop replaced', async () => {
		consentState.analytics = true
		render(<ConverterSurface pair={gltfToGlb} />)

		drop([gltfFile('first.gltf')])
		await waitFor(() => expect(loadCalls).toHaveLength(1))
		settle(0, loadedFile({ name: 'first.gltf', sourcePackageBytes: 9_000_000 }))
		await screen.findByTestId('stage')

		blockExports()
		exported.data = new Uint8Array(500_000)
		fireEvent.click(convertButton())

		drop([gltfFile('second.gltf')])
		await waitFor(() => expect(loadCalls).toHaveLength(2))
		settle(
			1,
			loadedFile({ name: 'second.gltf', sourcePackageBytes: 2_000_000 })
		)
		releaseExport()

		await waitFor(() =>
			expect(toast.error).toHaveBeenCalledWith(
				'A newer file replaced that one. Press Convert again.'
			)
		)
		expect(captured('convert_model_converted')).toEqual([])
	})

	it('sends nothing without analytics consent', async () => {
		render(<ConverterSurface pair={gltfToGlb} />)

		drop([gltfFile()])
		await waitFor(() => expect(loadCalls).toHaveLength(1))
		settle(0, loadedFile({ sourcePackageBytes: 2_000_000 }))
		await screen.findByTestId('stage')

		exported.data = new Uint8Array(1_000)
		fireEvent.click(convertButton())
		fireEvent.click(await screen.findByRole('button', { name: /^Download/ }))

		expect(capture).not.toHaveBeenCalled()
	})
})
