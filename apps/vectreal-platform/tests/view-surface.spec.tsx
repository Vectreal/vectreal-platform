// @vitest-environment jsdom
/**
 * What `/view?src=<url>` shows for each thing a link can turn out to be.
 *
 * The fetch is stubbed at the global, so the page's real `fetchRemoteModel`
 * runs, and the loader is a fake that records what it was handed: the claim
 * under test is the page's, that a link it cannot read becomes a next step and
 * not an error, and that the bytes reach the loader the way a drop's would.
 *
 * The viewer is stubbed. It needs WebGL, and what is asserted is which model
 * reached it. The draft store is stubbed too: the handoff's claim is that it
 * writes a draft for the model on screen and lands on the Publisher's restore
 * URL, not how a draft is serialized, which `scene-draft-persistence` owns.
 */
import {
	fireEvent,
	render,
	screen,
	waitFor,
	within
} from '@testing-library/react'
import { createRoutesStub, useLocation } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ViewSurface } from '../app/components/view/view-surface'

type FakeState =
	| { status: 'empty' | 'loading'; file: null; error: null; progress: number }
	| {
			status: 'ready'
			file: { model: { name: string }; name: string }
			error: null
			progress: number
	  }
	| {
			status: 'error'
			file: null
			error: { message: string }
			progress: number
	  }

const EMPTY: FakeState = {
	status: 'empty',
	file: null,
	error: null,
	progress: 0
}

let loadCalls: File[][] = []
const loadsReady = (files: File[]): FakeState => ({
	status: 'ready',
	file: { model: { name: files[0].name }, name: files[0].name },
	error: null,
	progress: 100
})
let loadResult = loadsReady

/*
  The load whose model is on screen, as the real hook keeps it, and a gate
  that holds `load` open after the model is shown: the optimizer's ingest,
  which the handoff has to wait for.
*/
let token = 0
let onScreen = 0
let ingest: Promise<void> | null = null

vi.mock('@vctrl/hooks/use-load-model', async () => {
	const React = await import('react')
	return {
		useModelContext: () => {
			const [state, setState] = React.useState<FakeState>(EMPTY)
			const lastReady = React.useRef<FakeState | null>(null)
			const load = React.useCallback(
				async (
					{ files }: { files: File[] },
					options?: { onPublish?: (outcome: unknown) => void }
				) => {
					const mine = ++token
					loadCalls.push(files)
					const next = loadResult(files)
					const outcome = {
						...next,
						stillCurrent: () => token === mine,
						stillOnScreen: () => onScreen === mine
					}
					if (next.status === 'ready') {
						onScreen = mine
						lastReady.current = next
					}
					// A refused upload leaves the model on screen where it was.
					setState(
						next.status === 'error' && lastReady.current
							? lastReady.current
							: next
					)
					// Published as the model reaches the stage, before the ingest.
					if (next.status === 'ready') options?.onPublish?.(outcome)
					if (ingest) await ingest
					return outcome
				},
				[]
			)
			const reset = React.useCallback(() => {
				token += 1
				onScreen = 0
				lastReady.current = null
				setState(EMPTY)
			}, [])
			return { ...state, load, reset }
		}
	}
})

vi.mock('../app/hooks/scene-loader/use-scene-document-export', () => ({
	usePrepareGltfDocument: () => async () => ({ data: {}, assets: new Map() })
}))

let draftBlock: Promise<void> | null = null
const persistDraft = vi.fn(async () => {
	if (draftBlock) await draftBlock
	return 'draft-1'
})
vi.mock('../app/lib/domain/scene/client/scene-draft-persistence', () => ({
	persistPendingSceneDraftOrchestrator: (...args: unknown[]) =>
		persistDraft(...(args as []))
}))

vi.mock('../app/components/viewer/client-vectreal-viewer', () => ({
	ClientVectrealViewer: ({ model }: { model: { name: string } }) => (
		<div data-testid="stage" data-model={model.name} />
	)
}))

const capture = vi.fn()
vi.mock('posthog-js/react', () => ({ usePostHog: () => ({ capture }) }))

let analytics = true
vi.mock('../app/components/consent/consent-context', () => ({
	useConsent: () => ({ consent: { analytics } })
}))

const GLB = new TextEncoder().encode('glTF\u0002\u0000\u0000\u0000')
let fetchMock: ReturnType<typeof vi.fn>

function stubFetch(answer: (url: string) => Response) {
	fetchMock = vi.fn(async (input: URL | string) => answer(String(input)))
	vi.stubGlobal('fetch', fetchMock)
}

/** Where the handoff landed, as the Publisher would read it. */
function PublisherStub() {
	return <p data-testid="publisher">{useLocation().search}</p>
}

function renderAt(path: string) {
	const Stub = createRoutesStub([
		{ path: '/view', Component: ViewSurface },
		{ path: '/publisher', Component: PublisherStub }
	])
	return render(<Stub initialEntries={[path]} />)
}

const view = (link: string) => `/view?src=${encodeURIComponent(link)}`

/** The stage, apart from the status announcer that repeats its heading. */
const stage = () => within(screen.getByRole('region', { name: 'Model viewer' }))

beforeEach(() => {
	loadCalls = []
	loadResult = loadsReady
	analytics = true
	ingest = null
	draftBlock = null
	capture.mockClear()
	persistDraft.mockClear()
})

afterEach(() => {
	vi.unstubAllGlobals()
})

describe('/view', () => {
	it('opens a readable link through the loader, as a drop would', async () => {
		stubFetch(() => new Response(GLB))

		renderAt(view('https://models.example.com/m/chair.glb'))

		expect(await screen.findByTestId('stage')).toHaveAttribute(
			'data-model',
			'chair.glb'
		)
		expect(loadCalls[0].map((file) => file.name)).toEqual(['chair.glb'])
		expect(
			screen.getByText(/Served by models\.example\.com/)
		).toBeInTheDocument()
	})

	it('answers a refused read with the download-and-drop step, not an error', async () => {
		stubFetch(() => {
			throw new TypeError('Failed to fetch')
		})

		renderAt(view('https://no-cors.example.com/chair.glb'))

		expect(
			await stage().findByText(
				'The file at no-cors.example.com could not be read here'
			)
		).toBeInTheDocument()
		expect(
			screen.getByRole('link', { name: 'Download from no-cors.example.com' })
		).toHaveAttribute('href', 'https://no-cors.example.com/chair.glb')
		expect(screen.getByRole('button', { name: 'Choose a file' })).toBeVisible()
		expect(screen.queryByText('This file could not be opened')).toBeNull()
		expect(loadCalls).toEqual([])
		// Announced with its next step, not the heading alone.
		expect(screen.getByRole('status')).toHaveTextContent(
			/could not be read here\. .*drop it here/
		)
	})

	it('says a link has stopped answering when its host says so', async () => {
		stubFetch(() => new Response('gone', { status: 404 }))

		renderAt(view('https://a.example.com/old.glb'))

		expect(
			await stage().findByText('This link answered 404')
		).toBeInTheDocument()
	})

	it('refuses a link it will not fetch, before any request', async () => {
		stubFetch(() => new Response(GLB))

		renderAt(view('javascript:alert(1)'))

		expect(
			await screen.findByText('Only https:// links can be opened here.')
		).toBeInTheDocument()
		expect(fetchMock).not.toHaveBeenCalled()
	})

	it('shows the loader’s refusal when the file arrives but cannot be read', async () => {
		stubFetch(() => new Response(GLB))
		loadResult = () => ({
			status: 'error',
			file: null,
			error: { message: 'The file is not a valid glTF.' },
			progress: 0
		})

		renderAt(view('https://a.example.com/broken.glb'))

		expect(
			await screen.findByText('This file could not be opened')
		).toBeInTheDocument()
		expect(
			screen.getByText('The file is not a valid glTF.')
		).toBeInTheDocument()
		expect(screen.getByRole('status')).toHaveTextContent(
			'This file could not be opened. The file is not a valid glTF.'
		)
	})

	it('reports the outcome with the host, never the link', async () => {
		stubFetch(() => {
			throw new TypeError('Failed to fetch')
		})

		renderAt(view('https://a.example.com/m.glb?X-Amz-Signature=secret'))

		await waitFor(() =>
			expect(capture).toHaveBeenCalledWith('view_by_url_outcome', {
				outcome: 'unreachable',
				source: 'link',
				source_host: 'a.example.com'
			})
		)
		expect(JSON.stringify(capture.mock.calls)).not.toContain('secret')
	})

	it('reports nothing for a link the page has moved past', async () => {
		let release = () => {}
		ingest = new Promise<void>((resolve) => (release = resolve))
		stubFetch(() => new Response(GLB))
		renderAt(view('https://first.example.com/a.glb'))
		await screen.findByTestId('stage')

		fireEvent.change(screen.getByLabelText('Link to a 3D model file'), {
			target: { value: 'https://second.example.com/b.glb' }
		})
		fireEvent.click(screen.getByRole('button', { name: 'Open' }))
		await waitFor(() =>
			expect(screen.getByTestId('stage')).toHaveAttribute('data-model', 'b.glb')
		)
		release()

		await waitFor(() =>
			expect(capture).toHaveBeenCalledWith('view_by_url_outcome', {
				outcome: 'ready',
				source: 'link',
				source_host: 'second.example.com'
			})
		)
		expect(JSON.stringify(capture.mock.calls)).not.toContain(
			'first.example.com'
		)
	})

	it('reports nothing without analytics consent', async () => {
		analytics = false
		stubFetch(() => new Response(GLB))

		renderAt(view('https://a.example.com/m.glb'))

		await screen.findByTestId('stage')
		expect(capture).not.toHaveBeenCalled()
	})

	it('invites a link or a drop when there is no link', () => {
		stubFetch(() => new Response(GLB))

		renderAt('/view')

		expect(
			screen.getByRole('textbox', { name: 'Link to a 3D model file' })
		).toBeInTheDocument()
		expect(screen.getByText('Drop a model file here')).toBeInTheDocument()
		expect(fetchMock).not.toHaveBeenCalled()
	})

	describe('Open in Publisher', () => {
		it('hands the model on screen to the Publisher as a draft', async () => {
			stubFetch(() => new Response(GLB))
			renderAt(view('https://models.example.com/chair.glb'))

			fireEvent.click(
				await screen.findByRole('button', { name: 'Open in Publisher' })
			)

			expect(await screen.findByTestId('publisher')).toHaveTextContent(
				'?restore_draft=1&draft_id=draft-1'
			)
			expect(persistDraft).toHaveBeenCalledWith(
				expect.objectContaining({
					sceneMetaState: expect.objectContaining({ name: 'chair' }),
					sourceGlb: null
				})
			)
			expect(capture).toHaveBeenCalledWith('view_opened_in_publisher', {
				source: 'link',
				source_host: 'models.example.com'
			})
		})

		it('waits for the optimizer to hold the model before it can', async () => {
			let release = () => {}
			ingest = new Promise<void>((resolve) => (release = resolve))
			stubFetch(() => new Response(GLB))
			renderAt(view('https://models.example.com/chair.glb'))

			await screen.findByTestId('stage')
			expect(
				screen.getByRole('button', { name: 'Preparing for the Publisher' })
			).toBeDisabled()

			release()
			await waitFor(() =>
				expect(
					screen.getByRole('button', { name: 'Open in Publisher' })
				).toBeEnabled()
			)
		})

		it('does not hand over a model replaced while the draft was written', async () => {
			let release = () => {}
			draftBlock = new Promise<void>((resolve) => (release = resolve))
			stubFetch(() => new Response(GLB))
			renderAt(view('https://models.example.com/chair.glb'))

			fireEvent.click(
				await screen.findByRole('button', { name: 'Open in Publisher' })
			)
			await waitFor(() => expect(persistDraft).toHaveBeenCalled())

			// A drop lands while the draft is being written.
			onScreen = -1
			release()

			await waitFor(() =>
				expect(
					screen.getByRole('button', { name: 'Preparing for the Publisher' })
				).toBeDisabled()
			)
			expect(screen.queryByTestId('publisher')).toBeNull()
			expect(capture).not.toHaveBeenCalledWith(
				'view_opened_in_publisher',
				expect.anything()
			)
		})

		it('hands over a dropped file as from the device', async () => {
			stubFetch(() => new Response(GLB))
			const { container } = renderAt('/view')

			const input = container.querySelector(
				'input[type=file]'
			) as HTMLInputElement
			fireEvent.change(input, {
				target: { files: [new File([GLB], 'mine.glb')] }
			})

			fireEvent.click(
				await screen.findByRole('button', { name: 'Open in Publisher' })
			)
			await screen.findByTestId('publisher')
			expect(capture).toHaveBeenCalledWith('view_opened_in_publisher', {
				source: 'device'
			})
		})

		it('names a dropped file as from the device as soon as it is shown', async () => {
			stubFetch(() => new Response(GLB))
			const { container } = renderAt(view('https://models.example.com/a.glb'))
			await screen.findByText(/Served by models\.example\.com/)

			// The drop's ingest is still running.
			ingest = new Promise<void>(() => {})
			fireEvent.change(
				container.querySelector('input[type=file]') as HTMLInputElement,
				{ target: { files: [new File([GLB], 'mine.glb')] } }
			)

			expect(
				await screen.findByText(/Opened from your device/)
			).toBeInTheDocument()
			expect(screen.getByTestId('stage')).toHaveAttribute(
				'data-model',
				'mine.glb'
			)
			expect(screen.queryByText(/Served by/)).toBeNull()
		})

		it('stays available for a model a refused drop put back', async () => {
			let release = () => {}
			ingest = new Promise<void>((resolve) => (release = resolve))
			stubFetch(() => new Response(GLB))
			const { container } = renderAt(view('https://models.example.com/a.glb'))
			await screen.findByTestId('stage')

			// A file the loader refuses, while the link's model is still ingesting.
			loadResult = () => ({
				status: 'error',
				file: null,
				error: { message: 'Not a model.' },
				progress: 0
			})
			fireEvent.change(
				container.querySelector('input[type=file]') as HTMLInputElement,
				{ target: { files: [new File(['x'], 'notes.txt')] } }
			)
			release()

			await waitFor(() =>
				expect(
					screen.getByRole('button', { name: 'Open in Publisher' })
				).toBeEnabled()
			)
			expect(screen.getByText(/Served by models\.example\.com/)).toBeVisible()
		})
	})

	it('says a refused signed link may have expired, rather than that it is gone', async () => {
		stubFetch(() => new Response('denied', { status: 403 }))

		renderAt(view('https://bucket.example.com/m.glb?X-Amz-Signature=a'))

		expect(
			await stage().findByText('bucket.example.com refused this link (403)')
		).toBeInTheDocument()
		expect(stage().getByText(/signed link may have expired/)).toBeVisible()
	})

	it('reads the link again when it is opened again', async () => {
		let attempt = 0
		stubFetch(() => {
			attempt += 1
			if (attempt === 1) throw new TypeError('Failed to fetch')
			return new Response(GLB)
		})

		renderAt(view('https://flaky.example.com/m.glb'))
		fireEvent.click(await stage().findByRole('button', { name: 'Try again' }))

		expect(await screen.findByTestId('stage')).toHaveAttribute(
			'data-model',
			'm.glb'
		)
	})

	it("keeps the visitor's link out of what autocapture can record", async () => {
		stubFetch(() => {
			throw new TypeError('Failed to fetch')
		})

		renderAt(view('https://bucket.example.com/m.glb?X-Amz-Signature=a'))

		expect(
			await stage().findByRole('link', { name: /Download from/ })
		).toHaveClass('ph-no-capture')
	})
})
