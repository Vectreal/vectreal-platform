// @vitest-environment jsdom
/**
 * Deleting a scene, and the confirmation between the click and the mutation.
 *
 * The control has moved three times - a Danger Zone button, a fourth entry in
 * the header's action stack, an overflow menu of one item - and the path behind
 * it has not changed once. What is asserted here is that path, driven end to
 * end: click, confirm, payload. An earlier version of this file asserted
 * `submit` was *not* called in every test, which is satisfied by a control
 * wired to nothing; making it inert, renaming the verb to `rename` and
 * retargeting the mutation at the project all left it green.
 */

import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { SceneDeleteButton } from './scene-delete-button'

import type { DashboardMutationsApi } from '../../../hooks/use-dashboard-mutations'
import type { DashboardEntityRef } from '../../../lib/domain/dashboard/dashboard-confirmation'

const submit = vi.fn()
const mutationOptions = vi.fn()
/*
  Knobs, because `isDeleting` gates three things - the button, the confirm
  button's pending state, and the dialog's refusal to be dismissed - and with
  the state pinned to `idle` every one of those could be deleted without a test
  noticing. The error beside them is gated by `lastError`, not by this.

  Both busy values, not just `submitting`: the real fetcher passes through
  `loading` during the revalidation that follows the POST, and `state !== 'idle'`
  written as `state === 'submitting'` re-enables the control and lets the dialog
  be dismissed in exactly that window.
*/
let mutationState: DashboardMutationsApi['state'] = 'idle'
let mutationError: string | null = null

vi.mock('../../../hooks/use-dashboard-mutations', () => ({
	/*
	  Return type annotated on purpose: without it a field added to the hook and
	  read by the component arrives `undefined` here with no type error, and every
	  test in this file keeps passing against a shape the hook cannot produce.
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
  A draft, which `planSingleScene` puts on the `acknowledge` tier - so confirming
  is one click and the payload's `confirmationText` is null. A published scene
  needs the typed token, and that branch belongs to `dashboard-confirmation`'s
  own spec.
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
const DeleteButton = ({ canDelete }: { canDelete: boolean }) => (
	<SceneDeleteButton
		sceneId="scene-1"
		deleteRef={DELETE_REF}
		canDelete={canDelete}
		onDeleted={onDeleted}
	/>
)

function renderButton(canDelete: boolean) {
	return render(<DeleteButton canDelete={canDelete} />)
}

const deleteControl = () => screen.getByRole('button', { name: 'Delete scene' })

beforeEach(() => {
	submit.mockClear()
	mutationOptions.mockClear()
	onDeleted.mockClear()
	mutationState = 'idle'
	mutationError = null
})

/** Opens the confirmation behind the control. */
function openConfirmation() {
	fireEvent.click(deleteControl())
	return screen.getByRole('dialog')
}

describe('deleting the scene', () => {
	it('goes control, confirmation, mutation - in that order', () => {
		renderButton(true)

		const dialog = openConfirmation()

		/*
		  The dialog is a Radix `Dialog`, not an `AlertDialog` - deliberately, per
		  `confirm-destructive-dialog.tsx`, because the typed tier needs a focusable
		  input. An earlier version queried `alertdialog`, which matches nothing in
		  any state, so the assertion could not fail.
		*/
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
		  The other direction of the dismissal guard. Pinning only "does not close
		  while busy" leaves `if (!open && isDeleting)` weakenable to `if (!open)`,
		  which makes the confirmation permanently un-dismissable - Cancel, Escape,
		  the overlay and the X all dead - with every other test still green.
		*/
		renderButton(true)
		const dialog = openConfirmation()

		fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

		expect(dialog.isConnected).toBe(false)
		expect(submit).not.toHaveBeenCalled()
	})

	it('leaves this page when the mutation succeeds', () => {
		/*
		  Navigating away is the whole success path and it is wired through an
		  option, not a return value: `useDashboardMutations({})` type-checks and
		  strands the user on a scene that no longer exists.
		*/
		renderButton(true)

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
			  Driven as a sequence rather than rendered already-busy: the control is
			  disabled by then, so a test that starts in flight can never reach the
			  dialog, and the three guards living inside it went unasserted - the
			  confirm button's pending state, the refusal to be dismissed, and the
			  error a rejection has to leave on screen.
			*/
			const view = renderButton(true)
			const dialog = openConfirmation()

			fireEvent.click(screen.getByRole('button', { name: 'Delete scene' }))

			mutationState = state
			act(() => {
				view.rerender(<DeleteButton canDelete />)
			})

			// Pending, so the confirm button cannot be pressed a second time.
			const confirm = screen.getByRole('button', { name: /working/i })
			expect(confirm).toHaveProperty('disabled', true)

			/*
			  Cancel is `disabled={isPending}`, so clicking it never reaches
			  `onOpenChange` at all - an earlier version of this test proved nothing
			  by pressing it. The paths that do reach the guard are the ones that
			  bypass the footer: the header's X, the overlay, and Escape. The X is
			  the only one of them still clickable here.
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

	it('disables the control while a delete is already running', () => {
		mutationState = 'submitting'
		renderButton(true)

		expect(deleteControl()).toHaveProperty('disabled', true)
	})

	it('leaves a rejection on screen beside the button that caused it', () => {
		/*
		  `errorMessage={deleteMutation.lastError}` passed as `null` reads
		  identically until a delete is refused, and then the dialog closes over a
		  scene that is still there with nothing said.
		*/
		mutationError = 'Only organization owners and admins can delete a scene.'
		renderButton(true)

		expect(openConfirmation().textContent).toContain(mutationError)
	})
})

describe('a role that cannot delete', () => {
	it('gets nothing at all', () => {
		/*
		  Not a disabled control. There is no explanation to attach it to and
		  nothing for them to do about it, and a menu of one disabled item - which
		  this briefly was - opens onto nothing reachable, because Radix will not
		  focus a disabled item.
		*/
		renderButton(false)

		expect(screen.queryByRole('button')).toBeNull()
		expect(document.body.textContent).toBe('')
	})
})
