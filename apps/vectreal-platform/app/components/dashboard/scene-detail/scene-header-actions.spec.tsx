// @vitest-environment jsdom
/**
 * Delete, where the rest of the dashboard already keeps it.
 *
 * The scene page used to offer Delete as a full-width destructive button inside
 * a "Danger Zone" section of the details drawer, ungated: the route shipped no
 * capabilities at all, so every member got an affordance the mutation endpoint
 * then refused.
 *
 * The whole path is driven here - menu, confirmation, payload - rather than only
 * the gate. A first version of this file asserted `submit` was *not* called in
 * every test, which is satisfied by a Delete item wired to nothing: making the
 * menu item inert, renaming the verb to `rename` and retargeting the mutation at
 * the project all left it green.
 */

import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { SceneHeaderActions } from './scene-header-actions'

import type { DashboardMutationsApi } from '../../../hooks/use-dashboard-mutations'
import type { DashboardEntityRef } from '../../../lib/domain/dashboard/dashboard-confirmation'
import type { ScenePublishStateResponse } from '../../../types/api'

/* Radix's menu needs three browser APIs jsdom does not ship. */
globalThis.ResizeObserver ??= class {
	observe() {}
	unobserve() {}
	disconnect() {}
}
Element.prototype.hasPointerCapture ??= () => false
Element.prototype.setPointerCapture ??= () => {}
Element.prototype.releasePointerCapture ??= () => {}
Element.prototype.scrollIntoView ??= () => {}

const submit = vi.fn()
const mutationOptions = vi.fn()
/*
  Knobs, because `isDeleting` gates three things - the menu item, the confirm
  button's pending state, and the dialog's refusal to be dismissed - and with
  the state pinned to `idle` every one of those could be deleted without a test
  noticing. The error beside them is gated by `lastError`, not by this.

  Both busy values, not just `submitting`: the real fetcher passes through
  `loading` during the revalidation that follows the POST, and `state !==
  'idle'` written as `state === 'submitting'` re-enables the item and lets the
  dialog be dismissed in exactly that window.
*/
let mutationState: DashboardMutationsApi['state'] = 'idle'
let mutationError: string | null = null

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
	)
}))

vi.mock('../../../hooks/use-dashboard-mutations', () => ({
	/*
	  Return type annotated on purpose, the way `embed-options-panel.spec.tsx`
	  annotates its hook mock: without it a field added to the hook and read by
	  the component arrives `undefined` here with no type error, and every test in
	  this file keeps passing against a shape the hook cannot produce.
	*/
	useDashboardMutations: (options: unknown): DashboardMutationsApi => {
		mutationOptions(options)
		return {
			submit,
			state: mutationState,
			isBusy: mutationState !== 'idle',
			lastResponse: null,
			lastError: mutationError,
			pendingIds: new Set<string>()
		}
	}
}))

/*
  Stubbed, deliberately. The share drawer pulls in the publish fetcher and the
  whole embed panel; what this file is about is the menu beside it, and a
  failure in either of those should not read as a failure of the delete gate.
  `scene-share-drawer.spec.tsx` covers it directly.
*/
vi.mock('./scene-share-drawer', () => ({
	SceneShareDrawer: () => <button type="button">Publish &amp; Embed</button>
}))

const PUBLISH_STATE: ScenePublishStateResponse = {
	sceneId: 'scene-1',
	status: 'draft',
	publishedAt: null,
	publishedAssetId: null,
	publishedAssetSizeBytes: null
}

/*
  A draft, which `planSingleScene` puts on the `acknowledge` tier - so confirming
  is one click and the payload's `confirmationText` is null. A published scene
  would need the typed token, and that branch belongs to
  `dashboard-confirmation`'s own spec.
*/
const DELETE_REF: DashboardEntityRef = {
	type: 'scene',
	id: 'scene-1',
	name: 'Porsche',
	projectId: 'project-1',
	sceneStatus: 'draft'
}

const onDeleted = vi.fn()

/* Extracted so a rerender can hand back the identical element. */
const Actions = ({ canDelete }: { canDelete: boolean }) => (
	<SceneHeaderActions
		previewPath="/preview/project-1/scene-1"
		publisherPath="/publisher/scene-1"
		sceneId="scene-1"
		projectId="project-1"
		publishState={PUBLISH_STATE}
		onPublish={vi.fn()}
		deleteRef={DELETE_REF}
		canDelete={canDelete}
		onDeleted={onDeleted}
	/>
)

function renderActions(canDelete: boolean) {
	return render(<Actions canDelete={canDelete} />)
}

const menuTrigger = () =>
	screen.getByRole('button', { name: /more scene actions/i })

const openMenu = () =>
	fireEvent.pointerDown(
		menuTrigger(),
		new MouseEvent('pointerdown', { bubbles: true, button: 0 })
	)

const deleteItem = () => screen.getByRole('menuitem', { name: /delete scene/i })

beforeEach(() => {
	submit.mockClear()
	mutationOptions.mockClear()
	onDeleted.mockClear()
	mutationState = 'idle'
	mutationError = null
})

/** Opens the menu and the confirmation behind it. */
function openConfirmation() {
	openMenu()
	fireEvent.click(deleteItem())
	return screen.getByRole('dialog')
}

describe('deleting the scene', () => {
	it('goes menu, confirmation, mutation - in that order', () => {
		renderActions(true)
		openMenu()

		fireEvent.click(deleteItem())

		/*
		  The dialog is a Radix `Dialog`, not an `AlertDialog` - deliberately, per
		  `confirm-destructive-dialog.tsx`, because the typed tier needs a focusable
		  input. A first version of this file queried `alertdialog`, which matches
		  nothing in any state, so the assertion could not fail.
		*/
		const dialog = screen.getByRole('dialog')
		expect(dialog.textContent).toContain('Delete "Porsche"?')
		// Opening a confirmation must never be the mutation itself.
		expect(submit).not.toHaveBeenCalled()

		fireEvent.click(screen.getByRole('button', { name: 'Delete scene' }))

		/*
		  The payload, not just the call. Renaming the verb or retargeting this at
		  the project reads identically on screen and deletes the wrong thing.
		*/
		expect(submit).toHaveBeenCalledTimes(1)
		expect(submit.mock.calls[0][0]).toEqual({
			verb: 'delete',
			targets: [{ type: 'scene', id: 'scene-1' }],
			confirmationText: null
		})
	})

	it('closes on cancel when nothing is in flight', () => {
		/*
		  The other direction of the dismissal guard. Pinning only 'does not close
		  while busy' leaves `if (!open && isDeleting)` weakenable to `if (!open)`,
		  which makes the confirmation permanently un-dismissable - Cancel, Escape,
		  the overlay and the X all dead - with every other test still green.
		*/
		renderActions(true)
		const dialog = openConfirmation()

		fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

		expect(dialog.isConnected).toBe(false)
		expect(submit).not.toHaveBeenCalled()
	})

	it('disables the menu item while a delete is already running', () => {
		/*
		  Rendered already-busy, because the sequence test below cannot reach this:
		  opening the confirmation closes the menu, and it never reopens.
		*/
		mutationState = 'submitting'
		renderActions(true)
		openMenu()

		expect(deleteItem().getAttribute('aria-disabled')).toBe('true')
	})

	it('leaves this page when the mutation succeeds', () => {
		/*
		  Navigating away is the whole success path and it is wired through an
		  option, not a return value: `useDashboardMutations({})` type-checks and
		  strands the user on a scene that no longer exists.
		*/
		renderActions(true)

		expect(mutationOptions).toHaveBeenCalled()
		const options = mutationOptions.mock.calls[0][0] as {
			onSuccess?: () => void
		}
		options.onSuccess?.()

		expect(onDeleted).toHaveBeenCalledTimes(1)
	})

	it.each(['submitting', 'loading'] as const)(
		'holds the confirmation open and busy while state is %s',
		(state) => {
			/*
			  Driven as a sequence rather than rendered already-busy: the menu item
			  is disabled by then, so a test that starts in flight can never reach
			  the dialog, and the three guards living inside it went unasserted -
			  the confirm button's pending state, the refusal to be dismissed, and
			  the error a rejection has to leave on screen.
			*/
			const view = renderActions(true)
			const dialog = openConfirmation()

			fireEvent.click(screen.getByRole('button', { name: 'Delete scene' }))

			mutationState = state
			act(() => {
				view.rerender(<Actions canDelete />)
			})

			// Pending, so the confirm button cannot be pressed a second time.
			const confirm = screen.getByRole('button', { name: /working/i })
			expect(confirm).toHaveProperty('disabled', true)

			/*
			  Cancel is `disabled={isPending}`, so clicking it never reaches
			  `onOpenChange` at all - a first version of this test proved nothing by
			  pressing it. The paths that do reach the guard are the ones that bypass
			  the footer: the header's X, the overlay, and Escape. The X is the only
			  one of them still clickable here, so it is the one exercised.
			*/
			expect(screen.getByRole('button', { name: 'Cancel' })).toHaveProperty(
				'disabled',
				true
			)

			fireEvent.click(screen.getByRole('button', { name: 'Close' }))
			expect(dialog.isConnected).toBe(true)

			fireEvent.keyDown(document, { key: 'Escape' })
			expect(dialog.isConnected).toBe(true)

			expect(submit).toHaveBeenCalledTimes(1)
		}
	)

	it('leaves a rejection on screen beside the button that caused it', () => {
		/*
		  `errorMessage={deleteMutation.lastError}` passed as `null` reads
		  identically until a delete is refused, and then the dialog closes over a
		  scene that is still there with nothing said.
		*/
		mutationError = 'Only organization owners and admins can delete a scene.'
		renderActions(true)

		expect(openConfirmation().textContent).toContain(mutationError)
	})
})

describe('a role that cannot delete', () => {
	it('gets no menu at all', () => {
		/*
		  Not a disabled item beside an explanation, which is what `table-columns`
		  does. Delete is the only entry here, and Radix will not focus a disabled
		  item, so that menu opens onto nothing reachable and says nothing on the
		  way. The affordance is absent instead.
		*/
		renderActions(false)

		/*
		  The trigger, which is the assertion that can fail. A `queryByRole
		  ('menuitem')` beside it would be null in the `canDelete` case too, since
		  items do not exist until the menu opens - it reads as coverage and is not.
		*/
		expect(
			screen.queryByRole('button', { name: /more scene actions/i })
		).toBeNull()
	})

	it('still gets everything that is not destructive', () => {
		/*
		  Anchored, because "no menu" is also satisfied by a component that renders
		  nothing at all.
		*/
		renderActions(false)

		expect(screen.getByRole('link', { name: /preview/i })).not.toBeNull()
		expect(
			screen.getByRole('link', { name: /open in publisher/i })
		).not.toBeNull()
		expect(screen.getByRole('button', { name: /publish/i })).not.toBeNull()
	})
})

describe('the navigations', () => {
	it('keeps the two links pointing where they say', () => {
		renderActions(true)

		expect(
			screen.getByRole('link', { name: /preview/i }).getAttribute('href')
		).toBe('/preview/project-1/scene-1')
		expect(
			screen
				.getByRole('link', { name: /open in publisher/i })
				.getAttribute('href')
		).toBe('/publisher/scene-1')
	})
})
