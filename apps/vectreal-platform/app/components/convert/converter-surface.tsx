import { useModelFileInputs } from '@shared/components/hooks/use-model-file-inputs'
import { Button } from '@shared/components/ui/button'
import { Checkbox } from '@shared/components/ui/checkbox'
import { cn, formatFileSize } from '@shared/utils'
import { ModelExporter } from '@vctrl/core/model-exporter'
import { modelFormatForFileName } from '@vctrl/core/model-formats'
import { TextureCompressionError } from '@vctrl/core/model-optimizer'
import {
	useModelContext,
	type StructuredLoadError
} from '@vctrl/hooks/use-load-model'
import { canEncodeImage } from '@vctrl/hooks/use-optimize-model'
import fileSaver from 'file-saver'
import { useReducedMotion } from 'framer-motion'
import { useAtomValue } from 'jotai'
import { Download, FolderUp, Loader2 } from 'lucide-react'
import { usePostHog } from 'posthog-js/react'
import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	type FC
} from 'react'
import { useDropzone } from 'react-dropzone'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'

import { usePrepareGltfDocument } from '../../hooks/scene-loader/use-scene-document-export'
import { useSampleDownload } from '../../hooks/use-sample-download'
import { useTrackedHeight } from '../../hooks/use-tracked-height'
import {
	SOURCES_THAT_ARE_BUNDLES,
	bundleSourceCopy,
	sourceAcceptAttribute,
	type BundleSourceCopy
} from '../../lib/convert/convert-capabilities'
import {
	articleFor,
	CONVERT_OPTIONS,
	convertOptionsFor,
	type ConvertOption,
	type ConvertPair,
	USDZ_GLASS_NOTE
} from '../../lib/convert/convert-pairs'
import {
	activeConvertOptions,
	conversionKeyFor,
	convertRecipeKey,
	storeConversion
} from '../../lib/convert/convert-recipe'
import {
	buildConvertModelReceivedProps,
	buildConvertModelResultProps
} from '../../lib/domain/analytics/convert-events'
import { persistPendingSceneDraftOrchestrator } from '../../lib/domain/scene/client/scene-draft-persistence'
import { sceneViewerSettingsAtom } from '../../lib/stores/scene-settings-store'
import { useConsent } from '../consent/consent-context'
import { DitherGrain } from '../layout-components/dither-grain'
import { DitherSwap } from '../layout-components/dither-swap'
import {
	describeSizeChange,
	FileSizeComparison
} from '../layout-components/file-size-comparison'
import { SampleTiles } from '../layout-components/sample-tiles'
import { ClientVectrealViewer } from '../viewer/client-vectreal-viewer'

import type { LoadOutcome } from '@vctrl/hooks/use-load-model'

interface Props {
	pair: ConvertPair
}

/** What one conversion produced, stamped with the recipe that produced it. */
interface Conversion {
	bytes: Uint8Array
	fileName: string
	/** Said beside this result only, because only this model lost it. */
	note?: string
}

/**
 * Passes that replace the optimizer's document with a changed one.
 *
 * The distinction matters because it decides whether changing an option can be
 * answered from the document as it stands or needs the optimizer's source put
 * back first. `texturesOptimization` is destructive; Draco is not, because
 * `exportDocumentGLBDraco` clones the document and writes the copy.
 */
const DESTRUCTIVE_OPTIONS: readonly ConvertOption[] = ['webp']

/**
 * The recipe a document satisfies the moment it has been read.
 *
 * The optimizer ingests the adopted model straight from its source, with no
 * destructive pass applied, and everything that reads the document waits for
 * that ingest first (`stageIngest`). That is a known state, and saying `null`
 * for it said "unknown" - which `prepare` can never match, so the very first
 * Convert undid a pass that was never applied, on every page including the
 * ones offering no options at all. When undoing meant reading the file again,
 * that unmounted the viewer and spun for seconds on work already done.
 *
 * `dropSource` keeps `null`, because there the document is genuinely gone.
 */
const INGESTED_RECIPE = convertRecipeKey('doc', [])

/**
 * The container a result arrives in, when that is not the format itself.
 *
 * The button used to name the extension alone, which is the one thing on the
 * page that is not the format the visitor asked for: every glTF page said
 * "Download ZIP" under a "glTF converter" heading, beside "Convert to glTF".
 * Naming the format and, where they differ, the container, is both true at
 * once - and it stays true for a format that is written into an archive later.
 */
function downloadContainer(fileName: string, target: string): string {
	const extension = fileName.split('.').pop()?.toLowerCase()

	return extension && extension !== target ? ` (.${extension})` : ''
}

/**
 * The bytes the conversion actually started from.
 *
 * A bundle is its whole selection - a folder is what the visitor had. A
 * single-file source is not: the drop zone takes every file now, because
 * refusing them silently was worse, so a GLB dropped next to the `.blend` it
 * came from would otherwise be measured against both and report a reduction
 * that never happened.
 */
function measuredBytes(files: readonly File[]): number {
	const model = files.find(
		(file) => modelFormatForFileName(file.name)?.canImport
	)

	/*
	  Asked of the model that loaded, not of the page. The drop zone filters
	  nothing, so an OBJ and its textures load perfectly well on a GLB page - and
	  keying this on the page's own source excluded the siblings from the
	  baseline while the conversion very much contained them, reporting a large
	  increase that never happened.
	*/
	const isBundle = model ? modelFormatForFileName(model.name)?.isBundle : false
	const counted = isBundle || !model ? files : [model]

	return counted.reduce((total, one) => total + one.size, 0)
}

/**
 * What to tell someone whose file was refused.
 *
 * The loader already names what was wrong and the surface was throwing that
 * away for one sentence about the page's own source format - so dropping two
 * models at once, which the loader reports precisely, read as "Check it is a
 * valid GLB" about a GLB that was perfectly valid. Only the codes that are
 * written for a reader are passed through; the rest keep the sentence, because
 * a parser's own message is not copy.
 */
function refusalMessage(
	error: StructuredLoadError | null,
	pair: ConvertPair,
	bundleCopy: BundleSourceCopy | null
): string {
	switch (error?.code) {
		case 'unsupported_format':
			/*
			  The likeliest refusal here by far, now that the drop zone filters
			  nothing on purpose. The generic sentence sent someone who dropped a
			  perfectly good `.3ds` off to check their STL - a file they never
			  brought - which is the same defect the `multiple_models` case below
			  was written for.
			*/
			return `Nothing in that selection is a format we can read. This page converts ${pair.fromLabel}.`

		case 'multiple_models':
			/*
			  "One at a time" is impossible advice on a bundle page, which asks
			  for a whole folder one line above the stage. There the fix is to
			  take the extra model out, not to drop fewer files.
			*/
			return bundleCopy
				? 'That folder has more than one model in it. Leave just the one you want converted, with its own files.'
				: 'That selection has more than one model in it. Drop one at a time.'

		case 'missing_assets':
			return (
				bundleCopy?.refusal ??
				'That model refers to files that did not come with it. Drop the folder it lives in.'
			)

		case 'gltf_load_failed':
		case 'binary_load_failed':
			/*
			  The file arrived complete and would not parse, which is the one
			  thing the bundle copy must not be used for: it asks for the sibling
			  files, and on a glTF page that sentence is handed to someone who
			  brought the whole folder. Whether a bundle's parts are missing is
			  `missing_assets`, above.
			*/
			return `Check it is a valid ${pair.fromLabel}.`

		default:
			if (bundleCopy) return bundleCopy.refusal

			/*
			  "a", not `articleFor`, and this is the rule rather than an exception
			  to it: an article agrees with the word that follows it, and here
			  that word is always "valid". Reading the format label instead
			  produced "an valid FBX" - the same defect as "Drop a STL file here",
			  reintroduced by its own fix one line along.
			*/
			return `Check it is a valid ${pair.fromLabel}.`
	}
}

/** How many conversions to keep; `storeConversion` says why it is bounded. */
const KEPT_CONVERSIONS = 3

/*
  Frames the model the way a product shot would, rather than the way a default
  does. `defaultBoundsOptions` uses `margin: 1.5`, which leaves the subject small
  in the middle of a large stage - right for an editor with panels around it,
  wrong for a stage that is the page's one image. 0.9 matches the home hero, and
  the difference is most of the frame on a phone: `Bounds` fits the bounding
  sphere, so a long model seen end-on - which is where both samples start -
  spends its whole length on a radius that points at the camera.

  Margin only, and no `cameraOptions`. A custom camera position was tried and is
  the reason the rocket sat cropped in the top-right corner: drei's `Bounds`
  computes the framing from the camera it is given, so supplying one fights the
  thing doing the framing. The two surfaces that already get this right - the
  home hero at 0.9 and the docs preview at 1.4 - both pass a margin and nothing
  else.
*/
const STAGE_BOUNDS = { margin: 0.9 }

/**
 * Drop a file, watch it load, take it back in another format.
 *
 * THE STAGE IS THE POINT. The first version of this was a dashed rounded box
 * with a centred upload glyph, and after a successful conversion it showed a
 * filename and a button - so a company whose product is a 3D viewer answered
 * "glb to usdz" with a page containing no 3D. The viewer is the one piece of
 * credibility here that cannot be faked or templated, and it is the same code
 * the paid product runs on.
 *
 * It also answers a question the old version left open. A converter you have
 * never heard of, which promises not to upload your file, gives you a download
 * and no way to check it. Seeing the model appear is the check.
 *
 * Deliberately not the publisher's `EmptyStage`, which is the start of an
 * editor and reads like one: it offers the publisher walkthrough and promises
 * files stay put "until you save". A stranger who searched "gltf to glb" wants
 * a file back, and both are answers to a question they did not ask. What this
 * does share with it is the two-input arrangement, for the reason
 * `useModelFileInputs` records: `webkitdirectory` replaces the dialog rather
 * than extending it, so one input cannot offer both a file and a folder.
 */
export const ConverterSurface: FC<Props> = ({ pair }) => {
	const { load, file, status, progress, optimizer, reset } = useModelContext()
	const posthog = usePostHog()
	const { consent } = useConsent()
	const navigate = useNavigate()
	const prepareGltfDocument = usePrepareGltfDocument()
	const currentSettings = useAtomValue(sceneViewerSettingsAtom)

	/*
	  A slow turntable, because every model has a bad side and the default camera
	  finds it.

	  A sample can be longer than it is wide, and the viewer's default camera
	  looks straight down that axis - so the rocket arrives as a circle with four
	  fins. The obvious fix, handing the viewer a camera
	  position, is the wrong lever and has now been tried twice: `initializeCamera`
	  applies the given camera and `Bounds` then frames from it, so a position
	  meant as "stand to the side" reads as "stand here", and the model lands
	  cropped in a corner. Rotating the model instead would change the object that
	  USDZ is exported from, which is the reader's file.
	  
	  Turning it is the version that needs neither: every side comes past, the
	  page has motion nothing on a format farm has, and the one thing a stranger
	  wants to know - is my model intact - is answered from all round rather than
	  from whichever angle the exporter happened to leave it at.
	*/
	const prefersReducedMotion = useReducedMotion()
	const stageControls = useMemo(
		() => ({ autoRotate: !prefersReducedMotion, autoRotateSpeed: 1.2 }),
		[prefersReducedMotion]
	)

	/*
	  The core exporter directly, rather than `useExportModel`.

	  That hook exports and saves in one call, which is exactly the shape this
	  page should not have: it made Download mean "apply the passes, re-encode,
	  and put a file in your downloads folder", so the one number anybody wants -
	  what the conversion actually achieved - was only discoverable by looking at
	  the file afterwards. Holding the bytes lets the result be shown first and
	  saved second.
	*/
	const exporterRef = useRef(new ModelExporter())

	/* The size of what is on the stage, which every reduction is measured against. */
	const [sourceBytes, setSourceBytes] = useState<number | null>(null)
	const [selected, setSelected] = useState<ConvertOption[]>([])
	const [isConverting, setIsConverting] = useState(false)
	const [conversions, setConversions] = useState<Record<string, Conversion>>({})
	const [isHandingOff, setIsHandingOff] = useState(false)

	/*
	  The last refusal, stamped with the page it happened on and the attempt it
	  belongs to - read, not remembered, the way a conversion is.

	  WHY IT IS NOT A BOOLEAN. It was one, and a boolean has to be cleared by
	  every event that makes it untrue: a pair change, "Convert another", the
	  next drop starting. That is the three-hand-cleared-flags shape
	  `convert-recipe.ts` exists to have removed once already, and it failed the
	  same way - the surface survives a move along the rail, so a refusal earned
	  on `fbx-to-glb` stayed up on the next page and re-skinned itself to read
	  "Check it is a valid GLB" about a file that page never saw.

	  The stamp answers instead: a refusal shows only on the page that earned it.
	  `announcement` is what makes a repeat audible - `role="alert"` fires on
	  mount and on a content change, so refusing the same file twice was silent
	  for a screen reader.

	  IT COUNTS REFUSALS, NOT DROPS, and that distinction is the point. It used
	  to be the same counter that decided whether a load was still current, so
	  one number answered "is this result stale" and "has the reader heard this
	  already" - two questions that only happen to move together. Currency now
	  comes from the loader, and this counts the thing it is named after.
	*/
	const [refusal, setRefusal] = useState<{
		pair: string
		message: string
		announcement: number
	} | null>(null)
	const refusalCount = useRef(0)

	/*
	  Whether the model on the stage is still the one this page is about.

	  THIS IS THE LOADER'S CLOCK, NOT A SECOND ONE. `load` hands back a
	  `stillOnScreen` predicate, and this ref holds the one belonging to
	  whichever load the page adopted. It was a monotonic counter of our own
	  until the hook could answer the question, and a counter is what has to be
	  remembered at every site that retires a load - which is how "Convert
	  another" came to empty the stage while a drop still in flight put the
	  source back: `reset()` retired the load and nothing moved the counter.

	  ON SCREEN, NOT NEWEST. A refused drop is the newest load, but it leaves
	  this model on the stage and in the optimizer. Asking whether the adopted
	  load was still the newest made every refusal retire a model that was still
	  there, so a conversion running through one was thrown away with a message
	  about a newer file that did not exist.

	  Asked, never cached. A drop can land during a texture re-encode or a GLB
	  write as easily as during a parse, so the answer is only good at the
	  instant it is read.
	*/
	const stageLoad = useRef<(() => boolean) | null>(null)

	/*
	  Settles once the optimizer has ingested the model the page adopted.

	  The loader shows a model before the optimizer holds it, so until this
	  settles the optimizer's document is still the previous model's. Convert
	  pressed in that window exported the previous model under the new file's
	  name, so everything that reads the document waits for this first.

	  Handed over on adoption, not when a load starts: a drop that is refused
	  never reaches the stage, and waiting on its load waited on nothing.
	*/
	const stageIngest = useRef<Promise<void> | null>(null)

	/*
	  The page being looked at right now, for the benefit of a load that started
	  on a different one. A refusal earned by a drop the reader has already
	  navigated away from is not news when they come back.
	*/
	const currentPair = useRef(pair.slug)
	currentPair.current = pair.slug

	/*
	  Read when the event is sent, not when the file was dropped. The capture
	  below deliberately runs after an await that can be seconds long, and the
	  callback closes over whatever consent said at the start of it - so turning
	  analytics off while a large model was being read still sent the event.
	*/
	const consentRef = useRef(consent)
	consentRef.current = consent

	/*
	  Which destructive passes the document in memory has been given. Not state,
	  because nothing renders from it: it describes the optimizer's document, and
	  the only question asked of it is whether that document already matches what
	  is about to be exported.
	*/
	const appliedKey = useRef<string | null>(null)

	/*
	  What the pass behind `appliedKey` could not do, said beside every result
	  exported from that document, not only the one that ran it.
	*/
	const appliedNote = useRef<string | undefined>(undefined)

	const {
		fileInputRef,
		directoryInputRef,
		inputProps,
		openFilePicker,
		openDirectoryPicker
	} = useModelFileInputs((files) => void ingest(files))

	/*
	  WebP only where this browser can write it. Safari cannot, and its canvas
	  answers a request for WebP with a PNG rather than an error - so the box
	  turned the camera sample's 18 MB of JPEG textures into 190 MB of PNG and
	  took the tab down. The encoder refuses now; offering the box anyway would
	  promise a pass that can only fail.

	  Asked after mount because the answer lives in the browser. The options
	  render only once a model is on the stage, long after it has arrived.
	*/
	const [canWriteWebp, setCanWriteWebp] = useState(false)
	useEffect(() => {
		void canEncodeImage('webp').then(setCanWriteWebp)
	}, [])

	const options = useMemo(
		() =>
			convertOptionsFor(pair).filter(
				(option) => option !== 'webp' || canWriteWebp
			),
		[pair, canWriteWebp]
	)
	const bundleCopy = bundleSourceCopy(pair.from)
	const isBundle = (SOURCES_THAT_ARE_BUNDLES as readonly string[]).includes(
		pair.from
	)

	/*
	  Ticks that this target cannot honour are dropped rather than remembered, so
	  carrying `draco` off a GLB page and onto a glTF one cannot change which
	  conversion the page thinks it is looking at. It also means a tick survives a
	  detour: go to USDZ and back, and the box is still where you left it.
	*/
	const activeOptions = useMemo(
		() => activeConvertOptions(selected, options),
		[selected, options]
	)

	/* `conversionKeyFor` owns why a result belongs to a page and not a format. */
	const currentKey = conversionKeyFor(pair, activeOptions)
	const result = conversions[currentKey] ?? null

	/*
	  A move along the rail ends the refusal, and only the refusal.

	  The stamp stops one being *shown* on a page that did not earn it; without
	  this it is still in state and greets the reader as a fresh alert - and is
	  announced again - if they come back. What this must not do is retire the
	  drop in progress: the model it produces still lands on the stage, by
	  design, so discarding the bookkeeping that goes with it is how the file
	  row ends up printing one file's name beside another's size.
	*/
	useEffect(() => {
		setRefusal(null)
	}, [pair.slug])

	/*
	  Everything that describes the model on the stage, moved in one step.
	
	  These were once written and cleared separately in two places each, and the
	  cost was not tidiness: any path that changed the model without visiting
	  every clear site left them disagreeing - the stored result of one file
	  offered as another's, an `appliedKey` claiming a destructive pass on a
	  document that never had one. One writer means they cannot drift apart.
	*/
	const adoptSource = useCallback(
		(bytes: number, stillOnScreen: () => boolean, ingested: Promise<void>) => {
			setSourceBytes(bytes)
			// Every stored result describes bytes that came from the file replaced.
			setConversions({})
			appliedKey.current = INGESTED_RECIPE
			appliedNote.current = undefined
			stageLoad.current = stillOnScreen
			stageIngest.current = ingested
		},
		[]
	)

	const dropSource = useCallback(() => {
		setSourceBytes(null)
		setConversions({})
		appliedKey.current = null
		appliedNote.current = undefined
		stageLoad.current = null
		stageIngest.current = null
	}, [])

	const ingest = useCallback(
		async (files: File[]) => {
			/*
			  Nothing arrived, so nothing was superseded. Clearing the refusal
			  first wiped the message off the screen and put nothing in its place,
			  which is the silent-discard outcome that removing `accept` exists to
			  end. Only an empty folder reaches this: the picker returns earlier.
			*/
			if (files.length === 0) return

			/* Whatever was refused before, this drop supersedes the statement. */
			setRefusal(null)

			/*
			  `load` reports a refusal by returning an error state rather than
			  throwing, so the outcome is read from what it hands back. Deriving
			  it from `status` instead would be the `fetcher.state` mistake this
			  repo already paid for once: the value is read before the state it
			  describes has been committed.
			*/
			/*
			  ADOPTED WHEN THE MODEL REACHES THE STAGE, NOT WHEN `load` RESOLVES.
			  The loader publishes as soon as it has parsed, then awaits the
			  optimizer ingest, so resolving happens one ingest later. Adopting on
			  the resolved value left a window - seconds, on a large model - where
			  the viewer and `{file.name}` showed the new model while `sourceBytes`,
			  the size comparison and a live Download button all still described the
			  old one. `stillCurrent()` cannot help: inside that window the new load
			  genuinely is the current one. The two moments had to become one.

			  No currency check on the way in, and still one call to
			  `adoptSource`: the loader calls `onPublish` only for a load that is
			  still the current one, so a check here could never be false, and the
			  outer `loaded.stillCurrent()` below already covers the resolved path.
			  What goes stale is everything after, which is why `state.stillOnScreen`
			  is handed to `adoptSource` to be recorded as `stageLoad` rather than
			  read as a boolean here.
			*/
			/* Settles with this load, which is once its model is ingested. */
			let markIngested: () => void = () => undefined
			const ingested = new Promise<void>((resolve) => {
				markIngested = resolve
			})

			let adopted = false
			const adopt = (state: LoadOutcome) => {
				adopted = true
				const referenced = state.file?.sourcePackageBytes ?? 0
				adoptSource(
					referenced || measuredBytes(files),
					state.stillOnScreen,
					ingested
				)
			}

			const loaded = await load({ kind: 'files', files }, { onPublish: adopt })
			markIngested()
			const refused = loaded.status === 'error'

			/*
			  The capture happens either way: a file that was dropped was dropped,
			  and a visitor who tries two things in a row is two arrivals. Only
			  the page's own state is held back, because a superseded load must
			  not describe what is on the stage.
			*/
			if (loaded.stillCurrent()) {
				if (refused) {
					/*
					  Only where the reader can still see it. A load that outlives
					  the page it started on has nothing to say to the page they
					  are on now, and storing it anyway means it greets them if
					  they ever navigate back.
					*/
					if (currentPair.current === pair.slug) {
						setRefusal({
							pair: pair.slug,
							message: refusalMessage(loaded.error, pair, bundleCopy),
							announcement: ++refusalCount.current
						})
					}
				} else {
					/*
					  Nothing about the selection is adopted until the loader has
					  read it, and then all of it at once. Committing first meant a
					  refused file still replaced the name and the byte count of the
					  model that was - and still is - on the stage, so the file row
					  printed one file's name beside another's size.

					  `sourcePackageBytes` where the loader measured it: a folder
					  holds whatever was in it, and a glTF export usually sits
					  beside the `.blend` it came from. Counting those made a 40 MB
					  folder into a 3 MB file and reported a reduction that never
					  happened. The loader already walks the glTF's own references;
					  where it has not (an OBJ), the selection is the best statement
					  available.

					  It is the whole package on its own.
					  `calculateReferencedBytesFromFiles` returns the glTF plus its
					  buffers plus its textures, and `sourceTextureBytes` is a
					  breakdown of that figure rather than something to add to it -
					  adding it counted every texture twice, so a 5.2 MB folder
					  reported 8.2 MB and a 4.5 MB result claimed 45% saved instead
					  of 13%. The two other readers of the pair
					  (`run-optimization-pass`, `use-scene-size-initializer`) treat
					  it as a breakdown, which is what the names mean.
					*/
					/*
					  Only if `publish` never fired. A source that resolves without
					  publishing still has to be adopted, and adopting twice would
					  clear the conversions the first adoption just made room for.
					*/
					if (!adopted) adopt(loaded)
				}
			}

			if (consentRef.current?.analytics) {
				posthog?.capture(
					'convert_model_received',
					buildConvertModelReceivedProps(
						pair,
						files,
						refused ? 'refused' : 'loaded'
					)
				)
			}
		},
		[load, pair, bundleCopy, posthog]
	)

	const { getRootProps, getInputProps, isDragActive, rootRef } = useDropzone({
		onDrop: ingest,
		/*
		  NO `accept`, for any source. react-dropzone does not warn about a file
		  it filters - it hands `onDrop` the shortened list, so a dropped file
		  that does not match becomes an empty array and `ingest` returns. The
		  visitor drops a `.3ds` on this page and *nothing happens at all*: no
		  message, no error, no sign the page saw it.

		  It was already off for a bundle source, because it would have stripped
		  the `.bin` and the textures. The reasoning was never specific to
		  bundles: the loader validates, it names what was wrong, and this page
		  already renders that error. Filtering here only decides whether the
		  refusal is spoken or silent.

		  The hidden input keeps its `accept`, which is a hint in a file dialog
		  rather than a filter on what arrives.

		  `multiple` is on for the same reason, and it was the other half of the
		  same defect. react-dropzone does not refuse a multi-file drop when it
		  is off - it keeps the first file in whatever order the OS enumerated
		  and routes the rest to `fileRejections`, which this page never reads.
		  So an FBX dropped with its textures converted the first file silently,
		  and if that happened to be a `.png` the page reported the FBX invalid.
		  How many files may arrive is not a property of the target format: the
		  loader picks the model out of a selection and names it when there is
		  more than one.
		*/
		multiple: true,
		noClick: true,
		noKeyboard: true
	})

	const { download: sampleDownload, openSample } = useSampleDownload()
	const loadSample = async (id: string) => {
		try {
			await openSample(id, (file) => ingest([file]))
		} catch {
			toast.error('The sample could not be loaded. Try your own file instead.')
		}
	}

	const toggleOption = (option: ConvertOption) => {
		// Nothing to clear. The result on screen is whichever one matches the
		// recipe, so ticking a box changes the recipe and the panel follows.
		setSelected((current) =>
			current.includes(option)
				? current.filter((one) => one !== option)
				: [...current, option]
		)
	}

	/*
	  Makes the optimizer's document match `options`, then returns it with what
	  a partial pass left out, for the result to say. Null means the model it
	  started on is no longer on the stage.

	  A destructive pass is undone by restoring the optimizer's source, the model
	  as it was loaded, not by reading the file again. The re-read went through
	  the loader: it unmounted the stage while three.js decoded every texture
	  again, and claimed a load of its own, which a pass that threw left the page
	  asking about.
	*/
	const prepare = async (options: readonly ConvertOption[]) => {
		const startedFrom = stageLoad.current
		await stageIngest.current
		const stillOurs = () => startedFrom?.() ?? false
		if (!stillOurs()) return null

		/*
		  Read again after a restore or a pass, because either may replace it.
		  Asked once the ingest has settled, which is when an empty optimizer
		  stops meaning "not yet" and starts meaning "never": the loader keeps a
		  model on the stage whose ingest failed, so the page has to ask.
		*/
		const heldDocument = () => {
			const document = optimizer?._getDocument()
			if (!document) {
				throw new Error(
					`This model could not be prepared for conversion to ${pair.toLabel}.`
				)
			}
			return document
		}
		const document = heldDocument()

		const wanted = options.filter((one) => DESTRUCTIVE_OPTIONS.includes(one))
		const wantedKey = convertRecipeKey('doc', wanted)

		if (appliedKey.current === wantedKey) {
			return { document, note: appliedNote.current }
		}

		if (appliedKey.current !== INGESTED_RECIPE) {
			/*
			  Unknown until the restore is done. The hook puts the document back
			  and then reads a report, which can fail after the document is
			  already the original - so a failed restore is not a document that
			  still has its pass.
			*/
			appliedKey.current = null
			appliedNote.current = undefined
			try {
				await optimizer?.restoreSource()
			} catch (error) {
				if (!stillOurs()) return null
				throw new Error(
					'Those options could not be changed. Press Convert to try again, or drop the file again to start over.',
					{ cause: error }
				)
			}
			if (!stillOurs()) return null
			appliedKey.current = INGESTED_RECIPE
		}

		if (!wanted.includes('webp')) return { document: heldDocument() }

		/*
		  Unknown until the pass finishes, so a pass that throws leaves the next
		  Convert to restore the document rather than export what it left.
		*/
		appliedKey.current = null
		let note: string | undefined
		try {
			await optimizer?.texturesOptimization({
				targetFormat: 'webp',
				quality: 82
			})
		} catch (error) {
			if (!stillOurs()) return null
			/*
			  A texture the browser cannot re-encode, such as a KTX2 one, would
			  otherwise keep a model with one of them from converting at all.
			*/
			if (!(error instanceof TextureCompressionError)) {
				throw new Error(
					'The WebP pass failed. Untick it to download the file as it is.',
					{ cause: error }
				)
			}
			if (!error.isPartial) {
				throw new Error(
					'None of the textures could be recompressed as WebP. Untick it to download the file as it is.',
					{ cause: error }
				)
			}
			note = `${error.failed} of ${error.total} textures could not be recompressed and kept their own format.`
		}

		/*
		  Asked again, because re-encoding every texture is the slowest thing
		  this page does and the easiest window for a second file to land in, and
		  the write below is the one that tells the next Convert it may skip the
		  pass.
		*/
		if (!stillOurs()) return null

		const passed = heldDocument()
		appliedKey.current = wantedKey
		appliedNote.current = note
		return { document: passed, note }
	}

	const baseFileName = (file?.name ?? 'model').replace(/\.[^/.]+$/, '')

	const startOver = () => {
		dropSource()
		setRefusal(null)
		reset()
	}

	/*
	  Hands the model on the stage to the publisher.

	  A plain link to `/publisher` opened an empty publisher, because the model
	  lives in this route's `ModelProvider` and navigating away unmounts it - so
	  "Open it in the publisher" named a thing it did not do, and the reader had
	  to find and drop their file a second time.

	  The handoff it needed already existed and is the one the sign-in round trip
	  uses: write the document to IndexedDB as a pending draft, then enter the
	  publisher with `?restore_draft=1&draft_id=`, which `use-scene-draft` picks
	  up on arrival. Nothing new is invented here, and in particular no second
	  copy of the serialization - `usePrepareGltfDocument` is the same payload the
	  publisher's own save flow uploads.

	  It hands over the model as it was loaded, which is what the stage shows: a
	  WebP pass made for a download is undone first. Handed over with it, the
	  publisher took recompressed textures for the original, and every preset
	  started from them.
	*/
	const openInPublisher = async () => {
		if (!file) return
		/*
		  The handoff asks the same question every other await on this page asks,
		  and used to be the one place that did not. Both values it writes with -
		  `file` and `baseFileName` - are render-closure captures, and it awaits
		  to prepare the document, to serialize it and to navigate. A drop landing
		  in one of those gaps wrote whatever `prepareGltfDocument` found then
		  into a draft named after the model the visitor had pressed the button
		  for, and the publisher opened on the mixture.
		*/
		const startedFrom = stageLoad.current
		const stillOurs = () => startedFrom?.() ?? false

		setIsHandingOff(true)

		try {
			if (!(await prepare([]))) {
				toast.error('A newer file replaced that one. Press the button again.')
				return
			}
			const draftId = await persistPendingSceneDraftOrchestrator({
				modelAvailable: true,
				prepareGltfDocumentForUpload: prepareGltfDocument,
				sceneMetaState: {
					name: baseFileName,
					description: '',
					thumbnailUrl: ''
				},
				currentSettings,
				optimizationSettings: null,
				// As loaded, so the document is its own original.
				sourceGlb: null
			})

			if (!draftId) {
				toast.error('That model could not be handed over. Try the publisher.')
				return
			}

			/*
			  Checked after the document is written rather than only before it.
			  The draft is harmless where it lies - `use-scene-draft` only reads
			  one it is sent to by id - so the cost of abandoning it here is a row
			  nobody opens, against handing someone the wrong model.
			*/
			if (!stillOurs()) {
				toast.error('A newer file replaced that one. Press the button again.')
				return
			}

			await navigate(
				`/publisher?restore_draft=1&draft_id=${encodeURIComponent(draftId)}`,
				{ viewTransition: true }
			)
		} catch {
			toast.error('That model could not be handed over. Try the publisher.')
		} finally {
			setIsHandingOff(false)
		}
	}

	/** Runs the ticked passes and encodes the target format, without saving. */
	const runConversion = async () => {
		if (!file) {
			toast.error('No model loaded yet.')
			return
		}
		setIsConverting(true)

		try {
			/*
			  Files a conversion, if it is still about the model it was started
			  for.

			  DEFINED HERE, closing over the load, because the question is not
			  "is the stage current" - once a newer file has landed the stage is
			  perfectly current, it is just a different model. It is whether
			  *this* conversion still describes what the page is about, and only
			  the predicate belonging to the load it began from can answer that.

			  A closure rather than a parameter because all three writers below
			  sit after an export await - the USDZ writer, the GLB writer, and
			  the glTF writer plus a zip - and a fourth would have to remember.
			  Both values it writes with, `currentKey` and `baseFileName`, are
			  render-closure captures, so without this a conversion of file A
			  finishing after file B landed filed A's bytes under A's name into
			  the map the panel reads for B: the download was one model and
			  every figure printed around it was another.
			*/
			const startedFrom = stageLoad.current
			const stillOurs = () => startedFrom?.() ?? false
			const store = (conversion: Conversion) => {
				if (!stillOurs()) {
					/*
					  Said out loud, because the same event on the `prepare` path
					  already is. Declining here used to be a bare `return`: the
					  spinner ran to the end, the panel filed nothing, and the page
					  said nothing - so the visitor watched a conversion finish and
					  produce no download, with no way to tell that their newer drop
					  was the reason.
					*/
					toast.error('A newer file replaced that one. Press Convert again.')
					return
				}

				setConversions((current) =>
					storeConversion(current, currentKey, conversion, KEPT_CONVERSIONS)
				)

				if (consentRef.current?.analytics) {
					posthog?.capture(
						'convert_model_converted',
						buildConvertModelResultProps(
							pair,
							activeOptions,
							sourceBytes,
							conversion.bytes.byteLength
						)
					)
				}
			}

			const exporter = exporterRef.current

			/*
			  USDZ leaves through three.js rather than the document, which is why
			  `OPTIONS_BY_TARGET` gives it no options: a pass applied here would not
			  reach the bytes below. So it never waits for the optimizer, and never
			  undoes a pass the document carries from another format's page.
			*/
			if (pair.to === 'usdz') {
				const usdz = await exporter.exportThreeJSUSDZ(file.model)
				store({
					bytes: usdz.data,
					fileName: `${baseFileName}.usdz`,
					note:
						usdz.transmissiveMaterials.length > 0 ? USDZ_GLASS_NOTE : undefined
				})
				return
			}

			const prepared = await prepare(activeOptions)

			/*
			  `prepare` returns null only when the model it started on is no
			  longer on the stage; a failure to restore or recompress throws
			  instead, and the catch below reports it.
			*/
			if (!prepared) {
				toast.error('A newer file replaced that one. Press Convert again.')
				return
			}

			const { document, note } = prepared

			if (pair.to === 'glb') {
				const glb = activeOptions.includes('draco')
					? await exporter.exportDocumentGLBDraco(document)
					: await exporter.exportDocumentGLB(document)

				store({
					bytes: glb.data,
					fileName: `${baseFileName}.glb`,
					note
				})
				return
			}

			if (pair.to === 'gltf') {
				// glTF is a document plus its assets, so it arrives as a ZIP - which
				// is also why its "after" size is the archive, not the .gltf alone.
				const gltf = await exporter.exportDocumentGLTF(
					document,
					activeOptions.includes('draco') ? { draco: {} } : {}
				)
				const zip = await exporter.createZIPArchive(gltf, baseFileName)
				store({
					bytes: zip,
					fileName: `${baseFileName}.zip`,
					note
				})
				return
			}

			/*
			  Named rather than reached by falling off the end. glTF used to be
			  the else of everything, so a fourth writable format would have been
			  handed to the glTF writer and downloaded as a `.zip` full of the
			  wrong thing - while the page said it had converted to that format.
			  The target set cannot widen quietly (the pair ratchet demands pages
			  first), but when it does widen this says so instead of lying.

			  Not a compile-time check: `pair.to` is the whole format union,
			  because a narrower one would restate the set outside its owner.
			*/
			throw new Error(`No writer for ${pair.to}.`)
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : 'The conversion failed.'
			)
		} finally {
			setIsConverting(false)
		}
	}

	const handleDownload = () => {
		if (!result) return
		fileSaver.saveAs(new Blob([new Uint8Array(result.bytes)]), result.fileName)

		if (consentRef.current?.analytics) {
			posthog?.capture(
				'convert_model_downloaded',
				buildConvertModelResultProps(
					pair,
					activeOptions,
					sourceBytes,
					result.bytes.byteLength
				)
			)
		}
	}

	const isReady = status === 'ready' && Boolean(file)
	const stageBox = useTrackedHeight(rootRef)

	return (
		/*
		  One column until there is a model. Then, on a wide screen, the stage
		  keeps the room and everything about the file stands beside it, so the
		  model, the button and the reading are one glance instead of a stage
		  the width of the page with its controls below the fold.
		*/
		<div
			className={cn(
				isReady &&
					'lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-x-12'
			)}
		>
			{/*
			  `ds-sunken` rather than a dashed border: the ladder separates surfaces
			  by value, and a dashed rectangle is the single most recognisable
			  upload widget on the web.

			  IT IS SIZED TWO DIFFERENT WAYS ON PURPOSE. A canvas needs an aspect
			  ratio - it has no content to be as tall as. An empty state is the
			  opposite: it is a heading, a line, two buttons and two tiles, and at
			  375px that stack is taller than a 4:3 box, so pinning the ratio there
			  clipped the invitation off the top of its own frame. So the ratio
			  applies once there is a model, and before that the content sets the
			  height against a floor that keeps it looking like a stage.

			  The floor is deliberately low. It was first set for the pages that
			  show sample tiles, and the glTF sources have none - the samples are
			  GLB - so the same floor under a shorter empty state left 60% of the
			  stage blank at 1280px. A stage with less to show should be shorter,
			  not emptier.

			  `min-w-0` because the canvas has an intrinsic width and a grid item
			  defaults to `min-width: auto`, so without it the column sizes to the
			  canvas and the page scrolls sideways on a phone.
			*/}
			{/*
			  The surface is drawn by this wrapper, which follows the stage's
			  height rather than taking it, so the stage grows and shrinks instead
			  of jumping: when a model replaces the invitation, and when switching
			  source trades the samples for a folder button. The stage sits on its
			  bottom edge, where its invitation is anchored, and never shrinks to
			  the wrapper, or the height it reports would be the one it was given.
			*/}
			<div
				className={cn(
					'ds-sunken flex min-w-0 flex-col justify-end overflow-hidden rounded-2xl',
					stageBox?.animate &&
						'transition-[height] duration-(--duration-slow) ease-(--ease-out) motion-reduce:transition-none'
				)}
				style={{ height: stageBox?.height }}
			>
				<section
					{...getRootProps()}
					aria-label={`${pair.fromLabel} to ${pair.toLabel} converter`}
					className={cn(
						'relative isolate w-full min-w-0 shrink-0 overflow-hidden rounded-2xl transition-shadow',
						isReady && file && 'aspect-[4/3] sm:aspect-[16/10]',
						isDragActive && 'ring-2 ring-[rgb(var(--orange-rgb))] ring-inset'
					)}
				>
					<input {...getInputProps()} />

					{isReady && file ? (
						<ClientVectrealViewer
							model={file.model}
							theme="system"
							className="h-full w-full"
							boundsOptions={STAGE_BOUNDS}
							controlsOptions={stageControls}
						/>
					) : (
						/*
					  Anchored bottom-left rather than centred. A centred glyph over
					  centred copy over a centred outline button is the stock empty
					  state; putting the invitation where a caption would sit leaves
					  the stage reading as a stage, which is what it becomes one
					  second later.
					*/
						/*
					  On a wide screen the invitation keeps the bottom-left and the
					  samples take the bottom-right, so the stage's full width is a
					  composition rather than a caption with empty space beside it.
					  The grain is the page's own, rising from the right; it belongs
					  to the empty stage and goes when a model arrives.

					  What it offers depends on the source, samples for GLB and a
					  folder for a glTF bundle, so switching source dissolves the new
					  offer in rather than cutting to it. The grain stays put: it is
					  the stage, not the offer.
					*/
						<>
							<DitherGrain origin="right" />
							<DitherSwap
								as="div"
								value={pair.from}
								className="grid min-h-[17rem] content-end gap-8 p-6 sm:min-h-[20rem] sm:p-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end"
							>
								{status === 'loading' ? (
									<p
										aria-live="polite"
										className="text-muted-foreground flex items-center gap-2 text-sm"
									>
										<Loader2 className="h-4 w-4 animate-spin" aria-hidden />
										Reading your {pair.fromLabel}, {Math.round(progress)}%
									</p>
								) : (
									<>
										<div>
											<p className="text-h3 text-foreground max-w-sm">
												Drop{' '}
												{bundleCopy
													? bundleCopy.dropTarget
													: `${articleFor(pair.fromLabel)} ${pair.fromLabel} file`}{' '}
												here
											</p>
											{/*
								  The only line here, and only for a bundle source: the one
								  thing someone needs to know before they drop. Everything else
								  the old empty state said - read in your browser, no upload, no
								  account - the page heading two inches away says already.
								*/}
											{bundleCopy && (
												<p className="text-muted-foreground text-body-sm mt-4 max-w-md">
													{bundleCopy.instruction}
												</p>
											)}

											<div className="mt-8 flex flex-wrap items-center gap-2">
												<Button onClick={openFilePicker}>
													{bundleCopy
														? bundleCopy.chooseLabel
														: `Choose ${articleFor(pair.fromLabel)} ${pair.fromLabel} file`}
												</Button>
												{isBundle && (
													<Button
														variant="outline"
														onClick={openDirectoryPicker}
													>
														<FolderUp className="h-4 w-4" aria-hidden />
														Choose a folder
													</Button>
												)}
											</div>
										</div>

										{/*
								  Samples are GLB, so they are offered where GLB is what the
								  page reads. Building a glTF bundle at runtime to sample the
								  glTF pages would be a fixture pretending to be a file
								  somebody exported.
								*/}
										{pair.from === 'glb' && (
											<SampleTiles
												className="lg:w-md"
												label="Or open one of these"
												onOpen={loadSample}
												download={sampleDownload}
											/>
										)}
									</>
								)}
							</DitherSwap>
						</>
					)}
				</section>
			</div>

			{/*
			  Outside the stage, because a refusal has to be sayable in both of
			  its states. It used to live inside the empty state, which is the
			  only place it could never be needed twice: with a model already
			  converted the stage is not empty, the loader keeps that model, and
			  the second file failed in silence.
			*/}
			{refusal?.pair === pair.slug && (
				/*
				  Keyed on the announcement so a second refusal remounts the alert.
				  `role="alert"` announces on mount and on a content change, and
				  refusing the same file twice is neither - so the reader who most
				  needs to hear it heard nothing the second time.
				*/
				<p
					key={refusal.announcement}
					className="text-destructive text-body-sm mt-4"
					role="alert"
				>
					That could not be read. {refusal.message}
				</p>
			)}

			{/* `useModelFileInputs` owns why there are two of these. */}
			<input
				ref={fileInputRef}
				type="file"
				hidden
				multiple
				accept={isBundle ? undefined : sourceAcceptAttribute(pair.from)}
				{...inputProps}
			/>
			{isBundle && (
				<input
					ref={directoryInputRef}
					type="file"
					hidden
					multiple
					directory=""
					webkitdirectory=""
					{...inputProps}
				/>
			)}

			{isReady && file && (
				<div className="mt-8 flex flex-col gap-8 lg:col-start-2 lg:row-start-1 lg:mt-0">
					{/*
					  Two steps, not one. Download used to mean "apply the passes,
					  re-encode, and put a file in your downloads folder", so the one
					  number anybody converting a model wants - what it achieved - was
					  discoverable only by finding the file afterwards. Convert produces
					  the bytes and shows the reading; Download saves bytes that already
					  exist, so it is instant and cannot fail.
					*/}
					{/*
					  Two weights. `Convert another` is a reset that
					  throws the loaded model away, not a peer of the primary action, and
					  standing it immediately left of a solid button made a near-invisible
					  ghost the thing you read just before the one you press. It sits with
					  the file it would discard instead, and the primary gets a row of
					  its own.
					*/}
					<div className="flex min-w-0 flex-wrap items-baseline gap-x-4 gap-y-1">
						<p className="text-muted-foreground min-w-0 text-sm">
							<span className="text-foreground truncate font-medium">
								{file.name}
							</span>
							{sourceBytes !== null && <> · {formatFileSize(sourceBytes)}</>}
						</p>
						<button
							type="button"
							onClick={startOver}
							/*
							  `isHandingOff` as well as `isConverting`. "Convert
							  another" clears the source the publisher draft is
							  built from, so pressing it during "Opening the
							  publisher" emptied the model mid-serialization.
							*/
							disabled={isConverting || isHandingOff}
							className="text-muted-foreground hover:text-foreground text-sm underline underline-offset-4 transition-colors disabled:opacity-50"
						>
							Convert another
						</button>
					</div>

					{options.length > 0 && (
						<fieldset>
							<legend className="text-muted-foreground text-eyebrow mb-3">
								Before you download
							</legend>
							<div className="flex flex-col gap-3">
								{options.map((option) => (
									<label
										key={option}
										className="flex cursor-pointer items-start gap-3"
									>
										<Checkbox
											checked={activeOptions.includes(option)}
											onCheckedChange={() => toggleOption(option)}
											className="mt-0.5"
										/>
										<span className="min-w-0">
											<span className="text-foreground block text-sm font-medium">
												{CONVERT_OPTIONS[option].label}
											</span>
											<span className="text-muted-foreground block text-sm">
												{CONVERT_OPTIONS[option].description}
											</span>
										</span>
									</label>
								))}
							</div>
						</fieldset>
					)}

					{result ? (
						<Button onClick={handleDownload} className="self-start">
							<Download className="h-4 w-4" aria-hidden />
							Download {pair.toLabel}
							{downloadContainer(result.fileName, pair.to)}
						</Button>
					) : (
						<Button
							onClick={runConversion}
							disabled={isConverting || isHandingOff}
							className="self-start"
						>
							{isConverting && (
								<Loader2 className="h-4 w-4 animate-spin" aria-hidden />
							)}
							Convert to {pair.toLabel}
						</Button>
					)}

					{result && (
						/*
						  `ds-raised`, matching the index: a container sitting on the page
						  rather than a well you put something into. The stage above is the
						  well.
						*/
						<div className="ds-raised rounded-2xl p-6">
							<p className="text-muted-foreground text-eyebrow mb-1">
								{pair.fromLabel} to {pair.toLabel}
							</p>
							<FileSizeComparison
								sizeInfo={{
									initialSceneBytes: sourceBytes,
									currentSceneBytes: result.bytes.byteLength
								}}
								{...describeSizeChange(sourceBytes, result.bytes.byteLength)}
							/>
							{result.note && (
								<p className="text-foreground pb-2 text-sm">{result.note}</p>
							)}
							{pair.note && (
								<p className="text-muted-foreground pb-2 text-sm">
									{pair.note}
								</p>
							)}
						</div>
					)}

					<p className="text-muted-foreground text-body-sm">
						<button
							type="button"
							onClick={openInPublisher}
							disabled={isHandingOff || isConverting}
							className="hover:text-foreground underline underline-offset-4 transition-colors disabled:opacity-50"
						>
							{isHandingOff
								? 'Opening the publisher'
								: 'Open it in the publisher'}
						</button>{' '}
						to shrink it further or set the camera.
					</p>
				</div>
			)}
		</div>
	)
}
