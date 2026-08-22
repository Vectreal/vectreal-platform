// @vitest-environment jsdom
/**
 * The panel's refusal to hand out a broken snippet.
 *
 * `buildEmbedUrl` omits the token parameter rather than failing when there is
 * no key, so a tokenless snippet is not a partial one - it is a finished-looking
 * string that answers 404 on every site. That is the original bug's outcome
 * reached by a different route: skipping a step rather than mis-editing one.
 */

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { EmbedOptionsPanel } from '../app/components/embed/embed-options-panel'
import { EMBED_COPY } from '../app/lib/domain/embed/embed-snippet'

const load = vi.fn()

let token = ''
let loadError: string | null = null
let allowedDomains: string[] = ['shop.example.com']

vi.mock('../app/components/embed/use-embed-api-keys', () => ({
	useEmbedApiKeys: () => ({
		keys: [],
		allowedDomains,
		canCreateKey: true,
		loading: false,
		loadError,
		token,
		setToken: vi.fn(),
		selectedKeyId: '',
		selectKey: vi.fn(),
		createdPlaintext: null,
		createdKeyExpiresAt: null,
		dismissCreatedKey: vi.fn(),
		createKey: vi.fn(),
		creating: false,
		createError: null
	})
}))

vi.mock('react-router', () => ({
	Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
	useFetcher: () => ({ load, state: 'idle', data: undefined })
}))

const PROJECT_ID = 'project-1'
const SCENE_ID = 'scene-1'

const button = (name: string) =>
	screen.getByRole('button', { name: new RegExp(name, 'i') })

/**
 * Every copy action, including the one in the tab that is not mounted yet.
 *
 * Radix unmounts inactive tab content, so `Copy SDK` does not exist in the DOM
 * until its tab is selected - asserting on it without switching would be
 * asserting on nothing.
 */
const copyButtons = () => {
	const visible = [button(EMBED_COPY.copyUrl), button(EMBED_COPY.copyEmbed)]

	fireEvent.mouseDown(screen.getByRole('tab', { name: EMBED_COPY.tabSdk }))
	visible.push(button(EMBED_COPY.copySdk))

	return visible
}

function renderPanel() {
	return render(
		<EmbedOptionsPanel projectId={PROJECT_ID} sceneId={SCENE_ID} />
	)
}

describe('the copy actions wait for a key', () => {
	it('refuses to copy anything while there is no token', () => {
		token = ''
		renderPanel()

		expect(button(EMBED_COPY.testEmbedUrl)).toHaveProperty('disabled', true)

		for (const copy of copyButtons()) {
			expect(copy).toHaveProperty('disabled', true)
		}
	})

	it('releases every copy action once a token is present', () => {
		token = 'vctrl_realkeyab3x'
		renderPanel()

		for (const copy of copyButtons()) {
			expect(copy).toHaveProperty('disabled', false)
		}
	})

	it('puts the token into the snippet it offers', () => {
		token = 'vctrl_realkeyab3x'
		const { container } = renderPanel()

		const snippet = container.querySelector('pre')?.textContent ?? ''
		expect(snippet).toContain('token=vctrl_realkeyab3x')
	})
})

describe('the allowed-domains readout', () => {
	it('says the project allows none only when it actually knows that', () => {
		token = ''
		allowedDomains = []
		loadError = null
		renderPanel()

		expect(screen.getByText(EMBED_COPY.allowedDomainsEmpty)).not.toBeNull()
	})

	it('claims nothing about domains it could not load', () => {
		/*
		  A failed load reports zero domains. Telling a member who may not read
		  keys that their project allows none - directly under the notice saying
		  they are not allowed to know - is a false statement, not an empty state.
		*/
		token = ''
		allowedDomains = []
		loadError = 'You do not have permission to view API keys'
		renderPanel()

		expect(screen.queryByText(EMBED_COPY.allowedDomainsEmpty)).toBeNull()
	})
})
