// @vitest-environment jsdom
/**
 * The panel's refusal to hand out a broken snippet.
 *
 * `buildEmbedUrl` omits the token parameter rather than failing when there is
 * no key, so a tokenless snippet is not a partial one - it is a finished-looking
 * string that answers 404 on every site. That is the original bug's outcome
 * reached by a different route: skipping a step rather than mis-editing one.
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { EmbedOptionsPanel } from './embed-options-panel'
import {
	isEmbedKeyUsable,
	type EmbedApiKeyOption
} from '../../lib/domain/embed/embed-key-options'
import {
	EMBED_COPY,
	EMBED_DOCS_PATH
} from '../../lib/domain/embed/embed-snippet'

import type { EmbedApiKeysApi } from './use-embed-api-keys'

/*
  Radix's menu needs three browser APIs jsdom does not ship. Without them the
  copy menu cannot be opened at all, and the two guards that matter most here -
  that the button copies the tab you are looking at, and that a menu item does
  not - would have to be taken on trust.
*/
globalThis.ResizeObserver ??= class {
	observe() {}
	unobserve() {}
	disconnect() {}
}
Element.prototype.hasPointerCapture ??= () => false
Element.prototype.setPointerCapture ??= () => {}
Element.prototype.releasePointerCapture ??= () => {}
Element.prototype.scrollIntoView ??= () => {}

const writeText = vi.fn((_text: string) => Promise.resolve())
Object.defineProperty(navigator, 'clipboard', {
	value: { writeText },
	configurable: true
})

vi.mock('sonner', () => ({
	toast: { success: vi.fn(), error: vi.fn() }
}))

const load = vi.fn()

const LIVE_KEY: EmbedApiKeyOption = {
	id: 'key-live',
	name: 'Embed key for Demo',
	keyPreview: 'ab3x',
	value: 'vctrl_realkeyab3x',
	expiresAt: null,
	lastUsedAt: null,
	revoked: false,
	expired: false
}

let keys: EmbedApiKeyOption[] = []
let selectedKeyId = ''
let hasAnswer = true
let loadError: string | null = null
let allowedDomains: string[] = ['shop.example.com']

/*
  Reset between tests. These are module-level so the mock factory can read them,
  which means a test that forgets to set one silently inherits the previous
  test's value and can pass for the wrong reason.
*/
beforeEach(() => {
	keys = []
	selectedKeyId = ''
	hasAnswer = true
	loadError = null
	allowedDomains = ['shop.example.com']
	writeText.mockClear()
})

vi.mock('./use-embed-api-keys', () => ({
	/*
	  Return type annotated on purpose: without it a field added to the hook and
	  read by the panel arrives `undefined` here with no type error, and every
	  test in this file keeps passing against a shape the hook cannot produce.
	*/
	useEmbedApiKeys: (): EmbedApiKeysApi => {
		const selected = keys.find((key) => key.id === selectedKeyId)

		return {
			keys,
			allowedDomains,
			canCreateKey: true,
			loadError,
			/*
			  Both of these are derived here exactly as the hook derives them,
			  rather than being knobs of their own.

			  `hasAnswer` cannot be forced true alongside a `loadError`: that is the
			  state every guard below exists to rule out, and as a plain field it
			  would survive being set.
			  `token` as a free field would let the snippet carry a value no key in
			  the list holds, which is the paste path this redesign deleted: the
			  point is that the panel builds its snippet out of a key the user
			  picked and never typed.
			*/
			hasAnswer: hasAnswer && loadError === null,
			token:
				selected && isEmbedKeyUsable(selected) ? (selected.value ?? '') : '',
			selectedKeyId,
			selectKey: vi.fn(),
			createKey: vi.fn(),
			creating: false,
			createError: null,
			retry: vi.fn(),
			loading: false
		}
	}
}))

/*
  `to` forwarded as `href`, and `target` with it. Both links in this panel open
  in a new tab, and that is not decoration: in the publisher the panel sits
  inside an unsaved composition, so a same-tab navigation loses that work.
*/
vi.mock('react-router', () => ({
	Link: ({
		to,
		children,
		...rest
	}: {
		to: string
		children: React.ReactNode
	} & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
		<a href={to} {...rest}>
			{children}
		</a>
	),
	useFetcher: () => ({ load, state: 'idle', data: undefined })
}))

const PROJECT_ID = 'project-1'
const SCENE_ID = 'scene-1'

const button = (name: string) =>
	screen.getByRole('button', { name: new RegExp(name, 'i') })

const selectTab = (name: string) =>
	fireEvent.mouseDown(screen.getByRole('tab', { name }))

/** Opens the caret menu and returns its items. */
const openCopyMenu = () => {
	fireEvent.pointerDown(
		button(EMBED_COPY.copyOptions),
		new MouseEvent('pointerdown', { bubbles: true, button: 0 })
	)

	return screen.getAllByRole('menuitem')
}

function withLiveKey() {
	keys = [LIVE_KEY]
	selectedKeyId = LIVE_KEY.id
}

function renderPanel() {
	return render(<EmbedOptionsPanel projectId={PROJECT_ID} sceneId={SCENE_ID} />)
}

describe('the copy actions wait for a key', () => {
	it('offers nothing to copy while no key is selected', () => {
		renderPanel()

		/*
		  The whole section, not three disabled controls inside it.

		  Disabling was the previous enforcement, and it left a heading, a tab row,
		  a toolbar and an empty box on screen - the rule was right and the surface
		  read as broken. Asserting only on `pre` passes with all of that still
		  rendered, which is exactly the state this replaced, so the chrome is
		  named here too.
		*/
		expect(screen.queryByText(EMBED_COPY.embedCodeLabel)).toBeNull()
		expect(screen.queryAllByRole('tab')).toHaveLength(0)
		expect(screen.queryByRole('button', { name: /copy/i })).toBeNull()
		expect(document.querySelector('pre')).toBeNull()
	})

	it('releases every copy action once a key is selected', () => {
		withLiveKey()
		renderPanel()

		expect(screen.getByText(EMBED_COPY.embedCodeLabel)).not.toBeNull()
		expect(button(EMBED_COPY.testEmbedUrl)).toHaveProperty('disabled', false)
		expect(button(EMBED_COPY.copyHtml)).toHaveProperty('disabled', false)
		expect(button(EMBED_COPY.copyOptions)).toHaveProperty('disabled', false)
		expect(document.querySelector('pre')).not.toBeNull()
	})

	it('builds the snippet from the selected key, which was never typed', () => {
		withLiveKey()
		const { container } = renderPanel()

		const snippet = container.querySelector('pre')?.textContent ?? ''
		expect(snippet).toContain(`token=${LIVE_KEY.value}`)
	})

	it('offers nothing when the selected key cannot build a snippet', () => {
		/*
		  A legacy row - live, nameable, and with no recoverable value - is the
		  state every key in a pre-`encrypted_key` project is in. It must not
		  produce a tokenless snippet that looks finished.
		*/
		keys = [{ ...LIVE_KEY, value: null }]
		selectedKeyId = LIVE_KEY.id
		renderPanel()

		/*
		  Anchored to what the panel still renders. Re-anchoring this test from
		  disabled controls to an absent section left it holding two negatives, and
		  two negatives are satisfied by a panel that returns null for this state -
		  which is not the fix, it is a different bug.
		*/
		expect(screen.getByText(EMBED_COPY.accessTitle)).not.toBeNull()
		expect(screen.queryByText(EMBED_COPY.embedCodeLabel)).toBeNull()
		expect(document.querySelector('pre')).toBeNull()
	})
})

describe('the test button', () => {
	/*
	  Nothing exercised this at all: both existing assertions were about its
	  `disabled` attribute, so deleting the handler outright left the suite green.
	  Two things about it are load-bearing and neither was pinned.
	*/
	it('opens the embed URL the panel is offering', () => {
		withLiveKey()
		renderPanel()

		const open = vi.spyOn(window, 'open').mockReturnValue(null)
		fireEvent.click(button(EMBED_COPY.testEmbedUrl))

		expect(open).toHaveBeenCalledTimes(1)
		/*
		  The embed route, not the internal preview one. Asserting only on the
		  token left `buildInternalPreviewPath` with a token appended passing -
		  and "the two link targets stay distinct" is a bug this feature has
		  already had once.
		*/
		expect(open.mock.calls[0][0]).toContain(
			`/embed/${PROJECT_ID}/${SCENE_ID}?token=${LIVE_KEY.value}`
		)
		open.mockRestore()
	})

	it('sends a Referer, so the domain check is not the thing that fails', () => {
		/*
		  `noopener` without `noreferrer`, and the difference is the whole point of
		  the button. `noreferrer` strips the `Referer` header, and
		  `validatePreviewApiKeyForProject` then sees no requester host at all - off
		  a localhost-like instance that falls straight through to
		  `domain_not_allowed`, so the control meant to prove an embed works would
		  report every healthy production scene as broken.

		  `embed-access-policy.spec.ts` pins the policy half of this trap. This is
		  the caller half, which nothing held.
		*/
		withLiveKey()
		renderPanel()

		const open = vi.spyOn(window, 'open').mockReturnValue(null)
		fireEvent.click(button(EMBED_COPY.testEmbedUrl))

		expect(open.mock.calls[0][2]).toBe('noopener')
		open.mockRestore()
	})
})

describe('the split copy button', () => {
	it('copies the view you are looking at', () => {
		withLiveKey()
		renderPanel()

		selectTab(EMBED_COPY.tabSdk)
		fireEvent.click(button(EMBED_COPY.copySdk))

		/*
		  The SDK snippet, not the HTML one. A button hardcoded to one view reads
		  identically on screen and hands over the wrong thing.
		*/
		expect(writeText).toHaveBeenCalledTimes(1)
		expect(writeText.mock.calls[0][0]).toContain('VectrealEmbed')
	})

	it('copies just the URL from the menu without leaving the tab', () => {
		/*
		  This is what replaced the separate `Embed URL` section: the URL is a view
		  of the one artifact, so taking only it is a menu item rather than a
		  parcel of its own with its own input and copy button.
		*/
		withLiveKey()
		renderPanel()

		const items = openCopyMenu()
		const copyUrl = items.find((item) =>
			item.textContent?.includes(EMBED_COPY.copyUrl)
		)
		fireEvent.click(copyUrl as HTMLElement)

		const copied = writeText.mock.calls[0][0] as string
		expect(copied).toContain(`token=${LIVE_KEY.value}`)
		expect(copied).not.toContain('<iframe')
	})

	it('takes the whole menu away when the key stops working', () => {
		/*
		  This used to assert only that nothing was copied, and after the Embed Code
		  section became conditional it could no longer fail: the section unmounts,
		  the portalled menu goes with it, and a detached element takes no click -
		  so deleting the value guard in `copyView` left it green. The clipboard
		  half of the claim moved to `embed-snippet-card.spec.tsx`, where the card
		  stays mounted and the guard can actually be reached.

		  What is asserted here is the panel's own half, which nothing held: a key
		  revoked in another tab arrives on a revalidation and the surface offering
		  a snippet has to go, not merely stop responding.
		*/
		withLiveKey()
		const view = renderPanel()

		const items = openCopyMenu()
		expect(items[0].isConnected).toBe(true)

		keys = [{ ...LIVE_KEY, revoked: true, value: null }]
		act(() => {
			view.rerender(
				<EmbedOptionsPanel projectId={PROJECT_ID} sceneId={SCENE_ID} />
			)
		})

		expect(items[0].isConnected).toBe(false)
		expect(screen.queryByText(EMBED_COPY.embedCodeLabel)).toBeNull()
		expect(writeText).not.toHaveBeenCalled()
	})

	it('offers all three views in the menu', () => {
		withLiveKey()
		renderPanel()

		expect(openCopyMenu().map((item) => item.textContent)).toEqual([
			EMBED_COPY.copyHtml,
			EMBED_COPY.copySdk,
			EMBED_COPY.copyUrl
		])
	})
})

describe('the panel groups what it offers', () => {
	/*
	  One flat list of nine controls, six of them explained by a tooltip, gave
	  every affordance the same weight. These headings are the grouping.

	  Scoped to the panel, not the document: a Radix menu portals its content to
	  `document.body`, so a test that opens one would otherwise break these for a
	  reason that has nothing to do with grouping.
	*/
	const headingsOf = (container: HTMLElement) =>
		within(container).getAllByRole('heading')

	it('titles the two sections it is made of', () => {
		withLiveKey()
		const { container } = renderPanel()

		expect(headingsOf(container).map((h) => h.textContent)).toEqual([
			EMBED_COPY.accessTitle,
			EMBED_COPY.embedCodeLabel
		])
	})

	it('is one section until a key can build a snippet', () => {
		const { container } = renderPanel()

		expect(headingsOf(container).map((h) => h.textContent)).toEqual([
			EMBED_COPY.accessTitle
		])
	})

	it('puts every section on the rung both hosts leave open', () => {
		withLiveKey()
		/*
		  h4 in both: the publisher nests the panel under an accordion trigger that
		  Radix wraps in an h3, and the drawer nests it under `h3 Publishing` in a
		  wrapper that is deliberately untitled (`scene.tsx`). The drawer's wrapper
		  did carry `title="Embed"`, which put a fourth h4 above these and made
		  them read as its peers rather than its parts.
		*/
		const { container } = renderPanel()

		for (const heading of headingsOf(container)) {
			expect(heading.tagName).toBe('H4')
		}
	})

	it('sends the detail it no longer inlines to the embedding guide', () => {
		// With a key: the guide sits on the Embed Code heading row, and that row
		// only exists once there is code beneath it.
		withLiveKey()
		renderPanel()

		const guide = screen.getByRole('link', { name: EMBED_COPY.docsLink })

		expect(guide.getAttribute('href')).toBe(EMBED_DOCS_PATH)
		/*
		  In a new tab. The publisher hosts this panel inside an unsaved
		  composition, and there is no route blocker anywhere in it - a same-tab
		  navigation to the docs simply loses the work.
		*/
		expect(guide.getAttribute('target')).toBe('_blank')
	})

	it('opens project settings in a new tab too, for the same reason', () => {
		renderPanel()

		const settings = screen.getByRole('link', { name: EMBED_COPY.editProject })

		expect(settings.getAttribute('target')).toBe('_blank')
	})
})

describe('the drawer host does not label the panel a fourth time', () => {
	/*
	  Scraped from the host, because the outline this pins is one neither side can
	  see alone: the panel renders its own `h4`s, the drawer wrapped them in
	  another, and both files are individually correct. Rendering the drawer here
	  would mean standing up a portal, a publish fetcher and the route's loader
	  data to assert one prop.

	  The host used to be `scene.tsx` itself. When the scene detail page was split
	  into its two surfaces the panel moved to the drawer component, and this
	  assertion is why that move could not happen quietly: the `toBeGreaterThan`
	  below failed the build rather than passing over a file that no longer
	  mentions the panel.
	*/
	const HOST = readFileSync(
		join(
			dirname(fileURLToPath(import.meta.url)),
			'../dashboard/scene-detail/scene-share-drawer.tsx'
		),
		'utf8'
	)

	it('wraps the panel in an untitled section', () => {
		const usage = HOST.indexOf('<EmbedOptionsPanel')
		expect(usage, 'the share drawer still hosts the panel').toBeGreaterThan(-1)

		const before = HOST.slice(0, usage)
		const wrapperStart = before.lastIndexOf('<DetailPanelSection')
		expect(
			wrapperStart,
			'the panel sits inside a DetailPanelSection'
		).toBeGreaterThan(-1)

		const wrapper = before.slice(wrapperStart)

		/*
		  Every prop that makes `DetailPanelSection` emit a header row, not just
		  the one that was there: `description` and `action` do it too, and a
		  header row is what puts an extra rung above the panel's own.
		*/
		expect(wrapper).not.toContain('title=')
		expect(wrapper).not.toContain('eyebrow=')
		expect(wrapper).not.toContain('description=')
		expect(wrapper).not.toContain('action=')
	})
})

describe('the snippet without the size fields', () => {
	/*
	  The panel used to feed `width` and `height` from two of its own inputs. With
	  those gone the builder's defaults are what every user gets, so a default
	  that stopped being applied would ship a snippet sized `undefined` and
	  nothing on this surface would look wrong.
	*/
	it('carries the default box the builder falls back to', () => {
		withLiveKey()
		const { container } = renderPanel()

		const snippet = container.querySelector('pre')?.textContent ?? ''

		/*
		  The wrapper element, not a substring. `width: 100%` also appears in the
		  iframe's own hardcoded style, so asserting it loose passes with the
		  `DEFAULT_WIDTH` fallback deleted - which is exactly what it did in the
		  first version of this test.
		*/
		expect(snippet).toContain(
			'<div style="width: 100%; max-width: 100%; height: 400px;">'
		)
	})

	it('offers no field to set them with, and no field at all', () => {
		/*
		  Anchored to what the panel DOES render. On its own, "no field named
		  width" is satisfied by a panel that renders nothing at all - it survived
		  replacing the whole component with an empty div.

		  The anchor is the three views, because the panel now renders no `<input>`
		  whatsoever: the token field, its reveal toggle and the read-only URL
		  field are all gone, and a key is chosen from a `Select`.
		*/
		withLiveKey()
		const { container } = renderPanel()

		expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
			EMBED_COPY.tabHtml,
			EMBED_COPY.tabSdk,
			EMBED_COPY.tabUrl
		])
		expect(container.querySelectorAll('input')).toHaveLength(0)
		expect(screen.queryByLabelText(/width/i)).toBeNull()
		expect(screen.queryByLabelText(/height/i)).toBeNull()
	})
})

describe('the allowed-domains readout', () => {
	const chipList = () =>
		screen.queryByRole('list', { name: EMBED_COPY.allowedDomainsLabel })

	it('says the project allows none only when it actually knows that', () => {
		allowedDomains = []
		renderPanel()

		expect(screen.getByText(EMBED_COPY.allowedDomainsEmpty)).not.toBeNull()
	})

	it('claims nothing before an answer has arrived', () => {
		/*
		  The window this notice was wrong in on every render, server included: a
		  request in flight - or not yet dispatched - reports zero domains, exactly
		  like a project that really has none.
		*/
		allowedDomains = []
		hasAnswer = false
		renderPanel()

		expect(screen.queryByText(EMBED_COPY.allowedDomainsEmpty)).toBeNull()
	})

	it('claims nothing about domains it could not load', () => {
		/*
		  A failed load reports zero domains. Telling a member who may not read
		  keys that their project allows none - directly under the notice saying
		  they are not allowed to know - is a false statement, not an empty state.
		*/
		allowedDomains = []
		loadError = 'You do not have permission to view API keys'
		renderPanel()

		expect(screen.queryByText(EMBED_COPY.allowedDomainsEmpty)).toBeNull()
	})

	it('withholds the list itself, not just the notice', () => {
		/*
		  The notice was gated and the statements around it were not, so a member
		  who could not read the list still got a heading naming an empty region.
		  Gating one statement out of three reads as a fix and leaves the claim on
		  screen.
		*/
		loadError = 'You do not have permission to view API keys'
		renderPanel()

		expect(chipList()).toBeNull()
	})

	it('shows the domains as chips once they are known', () => {
		allowedDomains = ['shop.example.com', '*.myshop.com']
		renderPanel()

		expect(
			within(chipList() as HTMLElement)
				.getAllByRole('listitem')
				.map((item) => item.textContent)
		).toEqual(['shop.example.com', '*.myshop.com'])
	})
})
