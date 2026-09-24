// @vitest-environment jsdom
/**
 * The home page's snippet is code that runs, and the pane under it runs it.
 *
 * The snippet used to write `<VectrealViewer src={modelUrl} />`. The viewer has
 * no `src` prop and takes a loaded scene as `model`, and the install line left
 * out `three`, the viewer's peer, so the first code a developer met on the site
 * did not work. Nothing could catch that while the snippet was only text. Now
 * the Result pane mounts `snippet-result-client.tsx`, and these tests hold the
 * snippet to that module and to the viewer's manifest.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { OpenSourceSection } from './open-source-section'
import { HOME_PAGE_COPY } from '../../constants/product-copy'

const COPY = HOME_PAGE_COPY.openSource.result

// A failure is kept until forgotten, the way the model loader's cache keeps a rejected load.
const run = vi.hoisted(() => ({
	loaded: false,
	failure: null as Error | null
}))

vi.mock('./snippet-result-client', () => {
	run.loaded = true
	return {
		forgetModel: () => {
			run.failure = null
		},
		default: function SnippetResultClient() {
			if (run.failure) throw run.failure
			return <div>viewer mounted</div>
		}
	}
})

const CLIENT_SOURCE = readFileSync(
	resolve(import.meta.dirname, 'snippet-result-client.tsx'),
	'utf8'
)
const VIEWER_MANIFEST = JSON.parse(
	readFileSync(
		resolve(import.meta.dirname, '../../../../../packages/viewer/package.json'),
		'utf8'
	)
) as { peerDependencies: Record<string, string> }

beforeEach(() => {
	run.loaded = false
	run.failure = null
	vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
	vi.restoreAllMocks()
})

function renderSection() {
	render(
		<MemoryRouter>
			<OpenSourceSection />
		</MemoryRouter>
	)
	return screen.getByRole('region', {
		name: 'Installing and using @vctrl/viewer'
	}).textContent as string
}

describe('the home page snippet', () => {
	// React is the one peer left out: the snippet is for a React app, which has it.
	it('installs every peer the viewer declares', () => {
		const install = renderSection()
			.split('\n')
			.find((line) => line.startsWith('pnpm add'))
		const peers = Object.keys(VIEWER_MANIFEST.peerDependencies).filter(
			(name) => name !== 'react'
		)
		expect(peers.length).toBeGreaterThan(0)
		for (const peer of peers) expect(install?.split(' ')).toContain(peer)
	})

	it('is the code the Result pane runs', () => {
		const code = renderSection()
		const load = CLIENT_SOURCE.match(/useGLTF\(([^,]+),\s*('[^']+')\)/)
		const view = CLIENT_SOURCE.match(/return (<VectrealViewer[^\n]*\/>)/)
		expect(load).not.toBeNull()
		expect(view).not.toBeNull()
		// The file's address is the one thing that differs: the snippet names a placeholder path.
		expect(code).toContain(`useGLTF('/camera.glb', ${load?.[2]})`)
		expect(code).toContain(`return ${view?.[1]}`)
	})
})

describe('the Result pane', () => {
	it('loads nothing of the viewer until the reader presses Run', async () => {
		renderSection()
		expect(run.loaded).toBe(false)

		await act(async () => {
			fireEvent.click(screen.getByRole('button', { name: COPY.run }))
		})

		expect(await screen.findByText('viewer mounted')).toBeTruthy()
		expect(run.loaded).toBe(true)
	})

	it('offers to run again when the viewer fails, and runs it', async () => {
		run.failure = new Error('network error')
		renderSection()
		await act(async () => {
			fireEvent.click(screen.getByRole('button', { name: COPY.run }))
		})
		const retry = await screen.findByRole('button', { name: COPY.failed })

		await act(async () => {
			fireEvent.click(retry)
		})
		expect(await screen.findByText('viewer mounted')).toBeTruthy()
	})
})
