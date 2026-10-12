import { Button } from '@shared/components/ui/button'
import { cn } from '@shared/utils'
import {
	IMPORTABLE_FORMAT_LABELS,
	modelAcceptPattern
} from '@vctrl/core/model-formats'
import { useModelContext, type LoadOutcome } from '@vctrl/hooks/use-load-model'
import { useAtomValue } from 'jotai'
import { usePostHog } from 'posthog-js/react'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useDropzone } from 'react-dropzone'
import { useLocation, useNavigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'

import { ViewLinkForm } from './view-link-form'
import { ViewStagePanel } from './view-stage-panel'
import { usePrepareGltfDocument } from '../../hooks/scene-loader/use-scene-document-export'
import { persistPendingSceneDraftOrchestrator } from '../../lib/domain/scene/client/scene-draft-persistence'
import { sceneViewerSettingsAtom } from '../../lib/stores/scene-settings-store'
import {
	fetchRemoteModel,
	RemoteModelError
} from '../../lib/view/fetch-remote-model'
import { parseViewSource } from '../../lib/view/view-source'
import { useConsent } from '../consent/consent-context'
import { PageHero } from '../layout-components'
import { ClientVectrealViewer } from '../viewer/client-vectreal-viewer'

/** "GLB, glTF, STL, FBX or OBJ", from the format owner. */
export const FORMAT_LIST = new Intl.ListFormat('en', {
	type: 'disjunction'
}).format(IMPORTABLE_FORMAT_LABELS)

/** The page's promise in one line, shared by the hero and the meta tags. */
export const VIEW_PAGE_DESCRIPTION = `Drop a ${FORMAT_LIST} file, or paste a link to one. It opens in your browser, with no upload and no account.`

/** What became of a link, as the page reports it. */
type ViewOutcome =
	'ready' | 'load_error' | 'unreachable' | 'http_error' | 'unrecognized'

/**
 * The model the Publisher would be handed, once the optimizer holds it.
 *
 * The loader shows a model before its optimizer has ingested it, and the
 * handoff serializes the optimizer's document, so until a load's `load()`
 * settles the document is still the previous model's, or nothing. Recorded
 * only when a load settles ready; `stillOnScreen` is that load's own answer,
 * so a newer drop on the stage makes it false at once, and a refused one, which
 * puts this model back, makes it true again.
 */
interface Handoff {
	stillOnScreen: () => boolean
	from: URL | null
}

/**
 * Where the page is with the link in its address.
 *
 * `pending` is the first render whenever there is a link: the server, and the
 * client until its effect runs, cannot judge it, because the link is refused
 * when it points at this page's own origin and only the browser knows that.
 * Rendering a neutral "opening" there keeps the server HTML and the first
 * client render the same.
 *
 * `loaded` hands the stage to the loader, whose own state says what is on it.
 * `from` is the link it came from, or null for a file the visitor dropped.
 */
type LinkState =
	| { kind: 'idle' }
	| { kind: 'pending' }
	| { kind: 'invalid'; reason: string }
	| { kind: 'fetching'; url: URL; fraction: number | null }
	| { kind: 'failed'; url: URL; error: RemoteModelError }
	| { kind: 'loaded'; from: URL | null }

/**
 * `/view?src=<url>`: a model opened from a link, in the visitor's browser.
 *
 * The page fetches the link itself and hands the bytes to the loader as the
 * files a drop would have given it. That route, and not a scene payload, is
 * deliberate: on it a model's own references can name nothing for the browser
 * to request, because the glTF reader refuses external resources and the
 * three.js bridges block textures they were not handed. A scene payload is
 * parsed with references passed straight to three.js, which would fetch them,
 * cookies included when they point here.
 */
export function ViewSurface() {
	const [searchParams] = useSearchParams()
	const rawSrc = searchParams.get('src')
	/*
	  Opening the same link again is a new navigation with the same `src`, so
	  the fetch is keyed on the navigation too. Without it, Open after a failed
	  read (the visitor's connection back, a host's CORS rule fixed) did nothing.
	*/
	const location = useLocation()
	const navigationKey = location.key
	const model = useModelContext(true)
	const { load, reset } = model
	const prepareGltfDocument = usePrepareGltfDocument()
	// The defaults: nothing on this page edits them.
	const currentSettings = useAtomValue(sceneViewerSettingsAtom)
	const navigate = useNavigate()
	const [handoff, setHandoff] = useState<Handoff | null>(null)
	const [isHandingOff, setIsHandingOff] = useState(false)

	const [link, setLink] = useState<LinkState>(() =>
		rawSrc?.trim() ? { kind: 'pending' } : { kind: 'idle' }
	)

	/*
	  The read in flight, so a drop can abandon it. Without this the link's
	  model, arriving after the dropped one, would replace it.
	*/
	const fetchRef = useRef<AbortController | null>(null)

	/*
	  Whether a model has been on screen since the page last cleared, which is
	  what decides whether a refused drop leaves one there (the loader restores
	  the last model that reached the screen). The rendered status cannot answer
	  it at drop time: during an earlier drop's parse it reads 'loading' while
	  the model before it is still the one a refusal brings back.
	*/
	const shownModelRef = useRef(false)
	if (model.status === 'ready') shownModelRef.current = true

	/*
	  Read through refs so the effect below depends on the link alone. Either
	  object changing identity must not fetch the link again.
	*/
	const posthog = usePostHog()
	const { consent } = useConsent()
	const captureRef = useRef<
		(event: string, from: URL | null, props?: object) => void
	>(() => {})
	captureRef.current = (event, from, props) => {
		if (!consent?.analytics) return
		// The host only. The link itself can be a credential.
		posthog?.capture(event, {
			...props,
			source: from ? 'link' : 'device',
			...(from && { source_host: from.hostname })
		})
	}
	const report = (url: URL, outcome: ViewOutcome) =>
		captureRef.current('view_by_url_outcome', url, { outcome })

	/*
	  A settled load becomes the handoff's when its model is the one on screen.
	  On screen, not newest: a refused drop is the newest load, but it puts
	  this model back, and asking `stillCurrent` left that model with no
	  handoff at all.
	*/
	const adoptForHandoff = (outcome: LoadOutcome, from: URL | null) => {
		if (outcome.status === 'ready' && outcome.stillOnScreen()) {
			setHandoff({ stillOnScreen: outcome.stillOnScreen, from })
		}
	}

	useEffect(() => {
		const source = parseViewSource(rawSrc, window.location.origin)
		reset()
		shownModelRef.current = false
		setHandoff(null)

		if (source.kind === 'none') {
			setLink({ kind: 'idle' })
			return
		}
		if (source.kind === 'invalid') {
			setLink({ kind: 'invalid', reason: source.reason })
			return
		}

		const { url } = source
		const controller = new AbortController()
		/*
		  Set only when the page moves to another link. A drop aborts the fetch
		  too, but the link's own load still settled and is still its outcome.
		*/
		let retired = false
		fetchRef.current = controller
		setLink({ kind: 'fetching', url, fraction: null })

		const open = async () => {
			let files: File[]
			try {
				files = await fetchRemoteModel(url, {
					signal: controller.signal,
					onProgress: (fraction) =>
						setLink((current) =>
							current.kind === 'fetching' && current.url === url
								? { ...current, fraction }
								: current
						)
				})
			} catch (error) {
				// Abandoned for a newer link or a drop, which owns the page now.
				if (controller.signal.aborted) return
				if (!(error instanceof RemoteModelError)) throw error
				setLink({ kind: 'failed', url, error })
				report(url, error.kind === 'http' ? 'http_error' : error.kind)
				return
			}
			if (controller.signal.aborted) return

			setLink({ kind: 'loaded', from: url })
			const outcome = await load({ kind: 'files', files })
			if (retired) return
			// What the link did, whatever was dropped on the page meanwhile.
			report(url, outcome.status === 'ready' ? 'ready' : 'load_error')
			adoptForHandoff(outcome, url)
		}

		void open()
		return () => {
			retired = true
			controller.abort()
		}
	}, [rawSrc, navigationKey, load, reset])

	const onDrop = useCallback(
		async (files: File[]) => {
			if (!files.length) return
			fetchRef.current?.abort()

			/*
			  The link state moves when the dropped model reaches the stage, not
			  when the load settles an optimizer ingest later, so the bar never
			  names one model's source under another. A refused drop never
			  publishes and puts the previous model back, so the bar keeps naming
			  where that one came from.
			*/
			const modelWillReturn = shownModelRef.current
			const outcome = await load(
				{ kind: 'files', files },
				{ onPublish: () => setLink({ kind: 'loaded', from: null }) }
			)
			adoptForHandoff(outcome, null)
			if (!outcome.stillCurrent()) return
			if (outcome.status === 'error' && modelWillReturn) {
				// With nothing to put back, the stage says it instead.
				toast.error(outcome.error.message)
			}
		},
		[load]
	)

	const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
		onDrop,
		// No `accept` and `multiple` on, for the reasons `converter-surface.tsx`
		// records: the loader validates and names what was wrong, and a glTF
		// arrives with its siblings.
		multiple: true,
		noClick: true,
		noKeyboard: true
	})

	const chooseFile = (
		<Button variant="outline" onClick={open}>
			Choose a file
		</Button>
	)

	/*
	  The converter's handoff (`converter-surface.tsx`, `openInPublisher`): the
	  document goes to IndexedDB as a pending draft, and the Publisher restores
	  it on arrival. No account, and nothing leaves the browser. The converter's
	  undo step is absent because no pass ever runs here, so the document already
	  is the model as it was loaded.

	  Asked twice whether the model is still the one on screen: before the draft
	  is written, and after, because a drop can land during either await.
	*/
	const handoffReady = !isHandingOff && Boolean(handoff?.stillOnScreen())

	// A new navigation to the same link, which the fetch effect is keyed on.
	const retry = () => {
		void navigate(`${location.pathname}${location.search}`)
	}

	const openInPublisher = async () => {
		const current = handoff
		if (model.status !== 'ready' || !current?.stillOnScreen()) return

		setIsHandingOff(true)
		try {
			const draftId = await persistPendingSceneDraftOrchestrator({
				modelAvailable: true,
				prepareGltfDocumentForUpload: prepareGltfDocument,
				sceneMetaState: {
					name: model.file.name.replace(/\.[^/.]+$/, ''),
					description: '',
					thumbnailUrl: ''
				},
				currentSettings,
				optimizationSettings: null,
				sourceGlb: null
			})
			if (!draftId) {
				toast.error('That model could not be handed over. Try again.')
				return
			}
			if (!current.stillOnScreen()) {
				toast.error('A newer file replaced that one. Press the button again.')
				return
			}
			captureRef.current('view_opened_in_publisher', current.from)
			await navigate(
				`/publisher?restore_draft=1&draft_id=${encodeURIComponent(draftId)}`,
				{ viewTransition: true }
			)
		} catch {
			toast.error('That model could not be handed over. Try again.')
		} finally {
			setIsHandingOff(false)
		}
	}

	const stage = (() => {
		if (model.status === 'ready') {
			return (
				<ClientVectrealViewer
					model={model.file.model}
					className="h-full w-full"
				/>
			)
		}
		if (model.status === 'loading') {
			return (
				<ViewStagePanel
					busy={`Reading the model, ${Math.round(model.progress)}%`}
				/>
			)
		}
		if (model.status === 'error') {
			return (
				<ViewStagePanel heading="This file could not be opened">
					<p className="text-muted-foreground text-body-sm mt-4 max-w-lg">
						{model.error.message}
					</p>
					<div className="mt-8">{chooseFile}</div>
				</ViewStagePanel>
			)
		}

		switch (link.kind) {
			case 'pending':
				return <ViewStagePanel busy="Opening the link" />
			case 'fetching':
				return (
					<ViewStagePanel
						busy={`Fetching from ${link.url.hostname}${
							link.fraction === null
								? ''
								: `, ${Math.round(link.fraction * 100)}%`
						}`}
					/>
				)
			case 'failed':
				return (
					<LinkFailure link={link} chooseFile={chooseFile} onRetry={retry} />
				)
			default:
				return (
					<ViewStagePanel heading="Drop a model file here">
						<p className="text-muted-foreground text-body-sm mt-4 max-w-lg">
							{FORMAT_LIST}. It opens in your browser and is not uploaded.
						</p>
						<div className="mt-8">
							<Button onClick={open}>Choose a file</Button>
						</div>
					</ViewStagePanel>
				)
		}
	})()

	const from = link.kind === 'loaded' ? link.from : null

	/*
	  One announcer for the whole stage, always mounted. The panels swap whole
	  subtrees as the state moves, and a live region that mounts already holding
	  its text is often not read at all, while one holding a percentage reads
	  every chunk. This says each state once.
	*/
	const announcement =
		model.status === 'ready'
			? `${model.file.name} is open.`
			: model.status === 'loading'
				? 'Reading the model.'
				: model.status === 'error'
					? `This file could not be opened. ${model.error.message}`
					: link.kind === 'fetching'
						? `Fetching the model from ${link.url.hostname}.`
						: link.kind === 'failed'
							? `${failureCopy(link).heading}. ${failureCopy(link).body}`
							: ''

	return (
		<main>
			<PageHero
				heading="View a 3D model online"
				description={VIEW_PAGE_DESCRIPTION}
				actions={
					<ViewLinkForm
						key={rawSrc ?? ''}
						defaultValue={rawSrc ?? undefined}
						error={link.kind === 'invalid' ? link.reason : undefined}
					/>
				}
			/>
			<div className="container-page pb-32">
				<p role="status" className="sr-only">
					{announcement}
				</p>
				<section
					/*
					  react-dropzone marks its root `presentation`, which would also
					  silence the label. The stage is a place a visitor moves to, so
					  it is a named region.
					*/
					{...getRootProps({ role: 'region' })}
					aria-label="Model viewer"
					className={cn(
						'ds-sunken relative isolate w-full overflow-hidden rounded-2xl',
						// A model gets the stage's proportions; a message gets the room it needs.
						model.status === 'ready' && 'aspect-[4/3] sm:aspect-[16/10]',
						isDragActive && 'ring-2 ring-[rgb(var(--orange-rgb))] ring-inset'
					)}
				>
					<input {...getInputProps({ accept: modelAcceptPattern() })} />
					{stage}
				</section>

				{model.status === 'ready' && (
					<div className="mt-4 flex flex-wrap items-start justify-between gap-4">
						<div className="min-w-0">
							<p className="text-body-sm text-foreground truncate">
								{model.file.name}
							</p>
							<p className="text-body-sm text-muted-foreground">
								{from
									? `Served by ${from.hostname}. This link works for as long as they keep the file there.`
									: 'Opened from your device. Nothing was uploaded.'}
							</p>
						</div>
						<div className="flex flex-wrap items-center gap-2">
							{/* The drop zone takes no keyboard, so this is the way to another file without a mouse. */}
							<Button variant="ghost" size="sm" onClick={open}>
								Choose another file
							</Button>
							{from && <CopyLinkButton />}
							<Button onClick={openInPublisher} disabled={!handoffReady}>
								{isHandingOff
									? 'Opening the Publisher'
									: handoffReady
										? 'Open in Publisher'
										: 'Preparing for the Publisher'}
							</Button>
						</div>
					</div>
				)}
			</div>
		</main>
	)
}

/**
 * What to say when a link could not be read, as one heading and one line.
 *
 * Each says only what the page knows. A refused read is not proof the host
 * blocks it, because the browser reports a dropped connection and a mistyped
 * address the same way, and a status is not proof the file is gone: a 403 is
 * usually an expired signed link, a 503 usually passes.
 */
function failureCopy(link: Extract<LinkState, { kind: 'failed' }>) {
	const host = link.url.hostname
	const { kind, status } = link.error

	if (kind === 'unreachable') {
		return {
			heading: `The file at ${host} could not be read here`,
			body: `Usually that means ${host} does not let other sites read its files, though a dropped connection or a mistyped address look the same from here. Download it, then drop it here: it opens the same way, and stays in your browser.`
		}
	}
	if (kind === 'unrecognized') {
		return {
			heading: 'This link is not a model file',
			body: `Its address names no format this page reads (${FORMAT_LIST}), and its contents are not a GLB. If you have the file, drop it here.`
		}
	}
	if (status === 401 || status === 403) {
		return {
			heading: `${host} refused this link (${status})`,
			body: 'A signed link may have expired, or the file may need permission to read. Ask whoever sent it for a fresh link, or drop the file here if you have it.'
		}
	}
	if (status === 404 || status === 410) {
		return {
			heading: `This link answered ${status}`,
			body: `The file has moved or been removed. A link opens here only while ${host} still serves the file. If you have a copy, drop it here.`
		}
	}
	return {
		heading: `${host} answered ${status}`,
		body: 'That is usually temporary. Try the link again in a moment, or drop the file here if you have it.'
	}
}

function LinkFailure({
	link,
	chooseFile,
	onRetry
}: {
	link: Extract<LinkState, { kind: 'failed' }>
	chooseFile: ReactNode
	onRetry: () => void
}) {
	const { heading, body } = failureCopy(link)
	const { kind, status } = link.error
	const retryable =
		kind === 'unreachable' ||
		(kind === 'http' &&
			status !== undefined &&
			(status === 429 || status >= 500))

	return (
		<ViewStagePanel heading={heading}>
			<p className="text-muted-foreground text-body-sm mt-4 max-w-lg">{body}</p>
			<div className="mt-8 flex flex-wrap items-center gap-2">
				{kind === 'unreachable' && (
					<Button asChild>
						{/*
						  `ph-no-capture`: autocapture records a clicked link's href,
						  and this one is the visitor's link itself, which can be a
						  signed credential. `redactUrlSecrets` cannot see it, because
						  it is not in a `src=` parameter here.
						*/}
						<a
							href={link.url.href}
							target="_blank"
							rel="noopener noreferrer"
							className="ph-no-capture"
						>
							Download from {link.url.hostname}
						</a>
					</Button>
				)}
				{chooseFile}
				{retryable && (
					<Button variant="ghost" onClick={onRetry}>
						Try again
					</Button>
				)}
			</div>
		</ViewStagePanel>
	)
}

function CopyLinkButton() {
	const copy = async () => {
		try {
			await navigator.clipboard.writeText(window.location.href)
			toast.success('Link copied')
		} catch {
			toast.error('The link could not be copied. Copy it from the address bar.')
		}
	}

	return (
		<Button variant="ghost" size="sm" onClick={copy}>
			Copy link
		</Button>
	)
}
