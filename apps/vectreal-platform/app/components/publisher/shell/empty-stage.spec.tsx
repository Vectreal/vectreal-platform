// @vitest-environment jsdom
/**
 * The only way into the product that is not a drag.
 *
 * Every entry point in the app converges on this stage, and it held a single
 * file input carrying `webkitdirectory`. That attribute does not filter a
 * dialog, it replaces it: the browser opens a directory chooser and ignores
 * `accept`. So the button reading "Choose Files" could not choose a file, and
 * the single-file case was reachable only by dragging.
 *
 * These assert the two shapes a model arrives in, separately, because one input
 * cannot serve both.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { modelAcceptPattern } from '@vctrl/core/model-formats'
import { BUNDLE_FORMAT_IDS, modelFormat } from '@vctrl/core/model-formats'
import { MemoryRouter, useLocation } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { EmptyStage } from './empty-stage'
import { useSampleDownload } from '../../../hooks/use-sample-download'
import { sampleModelById } from '../../../lib/samples/sample-models'

beforeEach(() => {
	/* jsdom has no matchMedia; `useAcceptPattern` reads it through `useIsMobile`. */
	window.matchMedia = vi.fn().mockImplementation((query: string) => ({
		matches: false,
		media: query,
		addEventListener: vi.fn(),
		removeEventListener: vi.fn()
	}))
})

/** The empty stage as the shell renders it, holding the sample download above it. */
function ShellStage({
	onUpload,
	isMobile
}: {
	onUpload: (files: unknown) => Promise<unknown>
	isMobile?: boolean
}) {
	return (
		<EmptyStage
			isMobile={isMobile}
			onUpload={onUpload}
			sampleDownload={useSampleDownload()}
		/>
	)
}

function renderStage(
	onUpload = vi.fn().mockResolvedValue(undefined),
	isMobile?: boolean
) {
	const view = render(
		<MemoryRouter>
			<ShellStage onUpload={onUpload} isMobile={isMobile} />
		</MemoryRouter>
	)

	const inputs = Array.from(
		view.container.querySelectorAll<HTMLInputElement>('input[type="file"]')
	)

	return {
		onUpload,
		inputs,
		fileInput: inputs.find((input) => !input.hasAttribute('webkitdirectory')),
		directoryInput: inputs.find((input) =>
			input.hasAttribute('webkitdirectory')
		)
	}
}

describe('choosing a model', () => {
	it('offers an input that opens a file dialog', () => {
		const { fileInput } = renderStage()

		expect(fileInput).toBeDefined()
		/*
		  `accept` is only honored by a dialog that is not a directory chooser, and
		  it must be the format owner's answer rather than a list of its own. This
		  used to assert `toContain('.glb')`, which held for any pattern naming GLB
		  - including the hand-written one that also offered `.usda`, a format no
		  loader has ever read.
		*/
		expect(fileInput?.getAttribute('accept')).toBe(modelAcceptPattern())
	})

	it('names every format that needs its folder, not just glTF', () => {
		/*
		  THE DEFECT. This line said "A .gltf needs the folder holding its textures
		  and .bin" and was hand-written, while OBJ became both importable and a
		  bundle in the same changeset. An OBJ dropped here on its own therefore
		  lost its materials and came back grey, with nothing on the page having
		  said to bring the folder.

		  Asserted against `BUNDLE_FORMAT_IDS` rather than against the two
		  extensions spelled out, so the day a third bundle is declared this fails
		  instead of quietly under-reporting - which is the failure it is replacing.
		*/
		renderStage()

		const hint = screen.getByText(/needs the folder/i).textContent ?? ''

		expect(BUNDLE_FORMAT_IDS.length).toBeGreaterThan(1)
		for (const id of BUNDLE_FORMAT_IDS) {
			expect(hint).toContain(`.${modelFormat(id).extension}`)
		}
	})

	it('still offers an input that opens a directory dialog', () => {
		const { directoryInput } = renderStage()

		expect(directoryInput).toBeDefined()
	})

	it('opens the file dialog from the primary button, not the directory one', () => {
		const { fileInput, directoryInput } = renderStage()

		const openedFile = vi.fn()
		const openedDirectory = vi.fn()
		fileInput?.addEventListener('click', openedFile)
		directoryInput?.addEventListener('click', openedDirectory)

		screen.getByRole('button', { name: /choose a file/i }).click()

		expect(openedFile).toHaveBeenCalledTimes(1)
		expect(openedDirectory).not.toHaveBeenCalled()
	})

	it('opens the directory dialog only from the folder control', () => {
		const { fileInput, directoryInput } = renderStage()

		const openedFile = vi.fn()
		const openedDirectory = vi.fn()
		fileInput?.addEventListener('click', openedFile)
		directoryInput?.addEventListener('click', openedDirectory)

		screen.getByRole('button', { name: /choose a folder/i }).click()

		expect(openedDirectory).toHaveBeenCalledTimes(1)
		expect(openedFile).not.toHaveBeenCalled()
	})

	it('uploads the chosen file', () => {
		const { fileInput, onUpload } = renderStage()
		const file = new File(['glb'], 'chair.glb', { type: 'model/gltf-binary' })

		Object.defineProperty(fileInput, 'files', {
			configurable: true,
			value: [file]
		})
		fileInput?.dispatchEvent(new Event('change', { bubbles: true }))

		expect(onUpload).toHaveBeenCalledWith([file])
	})

	/*
	  Dropped beside the welcome panel rather than on it: the stage is the
	  target, so a file let go anywhere on it opens. Dropping on the region
	  itself would pass wherever the handlers lived.
	*/
	it('takes a drop anywhere on the stage, not only on the panel', async () => {
		const { onUpload } = renderStage()
		const file = new File(['glb'], 'chair.glb', { type: 'model/gltf-binary' })
		const stage = screen.getByRole('region', { name: 'Empty stage' })
		const panel = screen.getByRole('heading', { level: 1 }).parentElement
		const besideThePanel = Array.from(stage.children).find(
			(child) => child !== panel && !(child instanceof HTMLInputElement)
		)
		expect(besideThePanel).toBeDefined()

		fireEvent.drop(besideThePanel as Element, {
			dataTransfer: {
				files: [file],
				items: [{ kind: 'file', type: file.type, getAsFile: () => file }],
				types: ['Files']
			}
		})

		await waitFor(() => expect(onUpload).toHaveBeenCalledTimes(1))
		const [files] = onUpload.mock.calls[0] as [File[]]
		expect(files[0].name).toBe('chair.glb')
	})

	it('offers no folder picker on a phone, which has none to open', () => {
		renderStage(undefined, true)

		expect(screen.getByRole('button', { name: /choose a file/i })).toBeTruthy()
		expect(
			screen.queryByRole('button', { name: /choose a folder/i })
		).toBeNull()
	})

	/*
	  A file input fires no change event when the selection is identical, so
	  without clearing the value a second attempt at the same model after a
	  refusal did nothing at all.
	*/
	it('clears its value so the same file can be chosen again', () => {
		const { fileInput } = renderStage()
		const file = new File(['glb'], 'chair.glb', { type: 'model/gltf-binary' })

		/*
		  The value is seeded and backed by a real setter, and that is the whole
		  test. Asserting `value === ''` against an untouched input passed whether
		  or not the handler cleared anything - jsdom starts a file input at `''`
		  - so this could not fail, which was confirmed by deleting the assignment
		  and watching it stay green. jsdom also refuses a direct write to a file
		  input's value, hence the defined property rather than `fileInput.value =`.
		*/
		let value = 'C:\\fakepath\\chair.glb'
		Object.defineProperty(fileInput, 'value', {
			configurable: true,
			get: () => value,
			set: (next: string) => {
				value = next
			}
		})
		Object.defineProperty(fileInput, 'files', {
			configurable: true,
			value: [file]
		})

		expect(fileInput?.value).not.toBe('')

		fileInput?.dispatchEvent(new Event('change', { bubbles: true }))

		expect(fileInput?.value).toBe('')
	})
})

/** A response body that hands over `chunks`, each only once `gate` lets it through. */
function bodyOf(chunks: Uint8Array[], gate = () => Promise.resolve()) {
	return {
		getReader: () => ({
			read: async () => {
				await gate()
				return chunks.length
					? { done: false, value: chunks.shift() }
					: { done: true, value: undefined }
			}
		})
	}
}

/*
  A sample is a real download, 18 MB for the camera, and a click with nothing
  after it reads on a slow connection as a click that missed. The tile says
  how far it is until the publisher's own loading surface takes over.
*/
describe('a sample on its way down', () => {
	/** Half the rocket arrives at once; the rest waits for the returned release. */
	function holdRocketHalfway() {
		let release = () => {}
		const held = new Promise<void>((resolve) => (release = resolve))
		const rocketHalf = new Uint8Array(
			Math.ceil((sampleModelById('rocket')?.bytes ?? 0) / 2)
		)
		let reads = 0
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: true,
			body: bodyOf([rocketHalf, new Uint8Array(4)], () =>
				reads++ === 0 ? Promise.resolve() : held
			)
		})
		return () => release()
	}

	it('shows how far it is, takes no second click, and hands the file over', async () => {
		const release = holdRocketHalfway()
		const { onUpload } = renderStage()
		const rocket = screen.getAllByRole('button', { name: /Rocket/ })[0]

		fireEvent.click(rocket)
		await waitFor(() =>
			expect(rocket.textContent).toContain('Downloading, 50%')
		)
		expect(rocket.getAttribute('aria-busy')).toBe('true')
		expect(screen.getByText('Downloading Rocket')).toBeTruthy()

		fireEvent.click(rocket)
		fireEvent.click(screen.getAllByRole('button', { name: /Camera/ })[0])
		expect(globalThis.fetch).toHaveBeenCalledTimes(1)

		release()
		await waitFor(() => expect(onUpload).toHaveBeenCalledTimes(1))
		await waitFor(() => expect(rocket.getAttribute('aria-busy')).toBeNull())
	})

	it('still says so after the shell swaps the stage out and back', async () => {
		/*
		  What a link naming a sample does: taking the param off the URL
		  revalidates the publisher, whose loading surface replaces this screen
		  for a moment while the download runs on.
		*/
		const release = holdRocketHalfway()
		const onUpload = vi.fn().mockResolvedValue(undefined)
		function Shell({ shown }: { shown: boolean }) {
			const sampleDownload = useSampleDownload()
			return shown ? (
				<EmptyStage onUpload={onUpload} sampleDownload={sampleDownload} />
			) : null
		}
		const view = render(
			<MemoryRouter>
				<Shell shown />
			</MemoryRouter>
		)
		fireEvent.click(screen.getAllByRole('button', { name: /Rocket/ })[0])
		await waitFor(() =>
			expect(screen.getByText('Downloading Rocket')).toBeTruthy()
		)

		view.rerender(
			<MemoryRouter>
				<Shell shown={false} />
			</MemoryRouter>
		)
		view.rerender(
			<MemoryRouter>
				<Shell shown />
			</MemoryRouter>
		)

		const rocket = screen.getAllByRole('button', { name: /Rocket/ })[0]
		expect(rocket.getAttribute('aria-busy')).toBe('true')
		expect(rocket.textContent).toContain('Downloading, 50%')
		release()
		await waitFor(() => expect(onUpload).toHaveBeenCalledTimes(1))
	})
})

/*
  The home page's "open the camera" link names a sample in the URL, so the
  publisher opens it on arrival through the same path a tile click takes.
*/
describe('a sample named by the link', () => {
	function LocationProbe() {
		return <output data-testid="search">{useLocation().search}</output>
	}

	function renderAt(search: string) {
		const onUpload = vi.fn().mockResolvedValue(undefined)
		render(
			<MemoryRouter initialEntries={[`/publisher${search}`]}>
				<ShellStage onUpload={onUpload} />
				<LocationProbe />
			</MemoryRouter>
		)
		return onUpload
	}

	beforeEach(() => {
		// `fetchSampleModel` reads only these two; jsdom's Blob cannot go through Node's Response.
		globalThis.fetch = vi
			.fn()
			.mockResolvedValue({ ok: true, body: bodyOf([new Uint8Array(4)]) })
	})

	it('opens that sample and takes the param off the URL', async () => {
		const onUpload = renderAt('?sample=rocket')

		await waitFor(() => expect(onUpload).toHaveBeenCalledTimes(1))
		const [files] = onUpload.mock.calls[0] as [File[]]
		expect(files[0].name).toBe('rocket.glb')
		expect(screen.getByTestId('search').textContent).toBe('')
	})

	it('opens nothing for a sample it does not know', async () => {
		const onUpload = renderAt('?sample=not-a-sample')

		await waitFor(() =>
			expect(screen.getByTestId('search').textContent).toBe('')
		)
		expect(onUpload).not.toHaveBeenCalled()
	})
})
