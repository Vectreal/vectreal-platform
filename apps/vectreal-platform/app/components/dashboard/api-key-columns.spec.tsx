// @vitest-environment jsdom
/**
 * The cell that puts an API key in front of the person who owns it.
 *
 * Separate from the loader spec on purpose, because the two prove different
 * halves and neither implies the other: that one proves the decrypted value
 * reaches the payload, this one proves it reaches the screen. A cell that
 * rendered `keyPreview` and ignored `value` entirely would satisfy every
 * assertion in the loader spec.
 *
 * `table-columns.tsx` had no test of any kind before this file, which is also
 * why the cell was extracted into a component: `createApiKeyColumns` is a plain
 * function, so its inline `cell` render could not call a hook and could not be
 * mounted without a table around it.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
	ApiKeyNameCell,
	createApiKeyColumns,
	type ApiKeyRow
} from './table-columns'

import type { ReactElement } from 'react'

const VALUE = 'vctrl_9Qm2LpXtRv4Kd8Nb1YwZc7HsAe3Uab3x'

function row(overrides: Partial<ApiKeyRow> = {}): ApiKeyRow {
	return {
		id: 'key-1',
		name: 'Storefront key',
		description: null,
		keyPreview: 'ab3x',
		value: { readable: true, value: VALUE },
		createdBy: 'Moritz',
		projects: [],
		lastUsedAt: null,
		active: true,
		expiresAt: null,
		revokedAt: null,
		rotatedAt: null,
		...overrides
	}
}

const writeText = vi.fn(async () => undefined)

beforeEach(() => {
	vi.stubGlobal('navigator', { clipboard: { writeText } })
	writeText.mockClear()
})

afterEach(() => {
	vi.unstubAllGlobals()
	vi.restoreAllMocks()
})

describe('ApiKeyNameCell', () => {
	it('is the cell the table actually renders', () => {
		/*
		  The join between the two halves, and the one thing neither the loader
		  spec nor the rest of this file can see. Both would stay green with this
		  component extracted, tested, and wired to nothing - which is exactly how
		  a complete renderer ships that no surface calls.

		  So this drives the real column definition and renders whatever its `cell`
		  returns, rather than mounting `ApiKeyNameCell` by hand.
		*/
		const columns = createApiKeyColumns({
			onEdit: vi.fn(),
			onRevoke: vi.fn(),
			onRotate: vi.fn()
		})

		const nameColumn = columns.find(
			(column) => 'accessorKey' in column && column.accessorKey === 'name'
		)
		expect(nameColumn?.cell, 'the name column must render a cell').toBeTypeOf(
			'function'
		)

		const rendered = (
			nameColumn!.cell as (context: { row: { original: ApiKeyRow } }) => unknown
		)({ row: { original: row() } })

		render(rendered as ReactElement)

		expect(screen.getByText(VALUE)).not.toBeNull()
	})

	it('finds a row by the last four characters of its key', () => {
		/*
		  The support workflow: an embed is failing and its owner has the key in
		  front of them. Against the default name-only filter, no part of that key
		  matches anything.

		  Deliberately the preview and not the whole value - the search box writes
		  through to the URL, so a full key typed here would land in `$current_url`,
		  in history and in every access log, which is the one place nothing
		  redacts it.
		*/
		const columns = createApiKeyColumns({
			onEdit: vi.fn(),
			onRevoke: vi.fn(),
			onRotate: vi.fn()
		})

		const nameColumn = columns.find(
			(column) => 'accessorKey' in column && column.accessorKey === 'name'
		)
		const filterFn = nameColumn!.filterFn as unknown as (
			row: { original: ApiKeyRow },
			columnId: string,
			value: string
		) => boolean

		const target = { original: row() }

		expect(filterFn(target, 'name', 'ab3x'), 'by preview').toBe(true)
		expect(filterFn(target, 'name', 'Storefront'), 'by name').toBe(true)
		expect(
			filterFn(target, 'name', '   '),
			'an empty search keeps every row'
		).toBe(true)
		expect(filterFn(target, 'name', 'nothing-like-this')).toBe(false)
	})

	it('never matches a row by its full key value', () => {
		/*
		  The guard, not an incidental. Matching the value would make pasting a
		  live key into the search box the obvious move, and that box is URL-backed:
		  `redact-embed-token.ts` rewrites `token=` parameters and would not touch
		  this one.
		*/
		const columns = createApiKeyColumns({
			onEdit: vi.fn(),
			onRevoke: vi.fn(),
			onRotate: vi.fn()
		})

		const nameColumn = columns.find(
			(column) => 'accessorKey' in column && column.accessorKey === 'name'
		)
		const filterFn = nameColumn!.filterFn as unknown as (
			row: { original: ApiKeyRow },
			columnId: string,
			value: string
		) => boolean

		expect(filterFn({ original: row() }, 'name', VALUE)).toBe(false)
	})

	it('shows the whole key, not a preview', () => {
		/*
		  The defect this change fixes. The value is public by construction - it
		  ships in an `iframe src` on the customer's own page - and the embed panel
		  hands it over on demand, so this screen showing four characters was the
		  last surface still pretending otherwise.
		*/
		render(<ApiKeyNameCell row={row()} />)

		expect(screen.getByText(VALUE)).not.toBeNull()
		expect(screen.queryByText('...ab3x')).toBeNull()
	})

	it('copies the value, not the preview', async () => {
		render(<ApiKeyNameCell row={row()} />)

		fireEvent.click(screen.getByRole('button', { name: /copy api key/i }))

		await waitFor(() => expect(writeText).toHaveBeenCalledWith(VALUE))
	})

	it('reports the copy on the row that was copied', async () => {
		/*
		  Stated honestly: the isolation this asserts is structural today, because
		  each cell mounts its own `useClipboardCopy`. Keying the label on the row
		  id cannot be caught failing here, and the code comment on that line says
		  so rather than this test implying otherwise.

		  It is kept because the behaviour is what matters and the structure is not
		  guaranteed - if the hook is ever lifted to the table, this is the test
		  that fails.
		*/
		render(
			<>
				<ApiKeyNameCell row={row()} />
				<ApiKeyNameCell
					row={row({ id: 'key-2', name: 'Second key', keyPreview: '9zQ1' })}
				/>
			</>
		)

		fireEvent.click(
			screen.getByRole('button', {
				name: /copy api key storefront key \.\.\.ab3x/i
			})
		)

		await screen.findByRole('button', {
			name: /api key storefront key \.\.\.ab3x copied/i
		})
		expect(
			screen.getByRole('button', {
				name: /copy api key second key \.\.\.9zQ1/i
			})
		).not.toBeNull()
	})

	it('keeps the key out of session replay', () => {
		/*
		  `entry.client.tsx` returns `$snapshot` events from `before_send`
		  unmodified, so replay applies no redaction of its own. Unlike the
		  one-time dialog, this surface is on screen for as long as the page is,
		  showing every key of every organization the actor administers - so this
		  class is the only thing between a recording and all of them.
		*/
		render(<ApiKeyNameCell row={row()} />)

		expect(screen.getByText(VALUE).closest('.ph-no-capture')).not.toBeNull()
	})

	it('offers nothing to copy when there is no value', () => {
		render(
			<ApiKeyNameCell
				row={row({ value: { readable: false, reason: 'revoked' } })}
			/>
		)

		expect(screen.queryByRole('button', { name: /copy api key/i })).toBeNull()
		expect(screen.getByText('...ab3x')).not.toBeNull()
	})

	it('tells a revoked key apart from one that can be rotated back', () => {
		/*
		  The distinction the union exists for, and it is a wrong instruction
		  rather than a cosmetic slip: `rotateApiKey` refuses anything that is not
		  active, so telling the owner of a revoked key to rotate sends them at a
		  function that throws. They replace it instead.
		*/
		const { unmount } = render(
			<ApiKeyNameCell
				row={row({ value: { readable: false, reason: 'revoked' } })}
			/>
		)
		expect(screen.getByText(/the value was cleared/i)).not.toBeNull()
		expect(screen.queryByText(/rotate it/i)).toBeNull()
		unmount()

		/*
		  Asserted on the distinguishing prefix, not the shared tail. Both
		  recoverable reasons end in "rotate it to get a value you can copy", so a
		  test matching that would pass with the two strings swapped - and the
		  loader spec spends a whole test keeping them separable.
		*/
		const neverStored = render(
			<ApiKeyNameCell
				row={row({ value: { readable: false, reason: 'never-stored' } })}
			/>
		)
		expect(screen.getByText(/no value was stored for this key/i)).not.toBeNull()
		neverStored.unmount()

		render(
			<ApiKeyNameCell
				row={row({ value: { readable: false, reason: 'undecryptable' } })}
			/>
		)
		expect(
			screen.getByText(/the stored value is no longer readable/i)
		).not.toBeNull()
	})

	it('does not tell a key that cannot be rotated to rotate', () => {
		/*
		  The cause is recoverable and the key is not. `rotateApiKey` throws for
		  any state but `active`, and the Rotate menu item on this same row is
		  disabled by the same predicate - so the advice would point at a control
		  the user cannot press and a call that fails.

		  This is the pairing the reason strings deliberately do not bake in:
		  "no value was stored" is a fact about the row, "rotate it" is a fact
		  about its lifecycle, and only the second one is false here.
		*/
		const expired = render(
			<ApiKeyNameCell
				row={row({
					value: { readable: false, reason: 'never-stored' },
					expiresAt: new Date('2026-01-02T00:00:00.000Z')
				})}
			/>
		)

		expect(screen.getByText(/no value was stored/i)).not.toBeNull()
		expect(screen.queryByText(/rotate it/i)).toBeNull()
		expired.unmount()

		// The same cause on a live key does carry the advice.
		render(
			<ApiKeyNameCell
				row={row({ value: { readable: false, reason: 'never-stored' } })}
			/>
		)
		expect(screen.getByText(/rotate it to get a value/i)).not.toBeNull()
	})

	it('says why a value is withheld rather than showing nothing', () => {
		render(
			<ApiKeyNameCell
				row={row({ value: { readable: false, reason: 'withheld' } })}
			/>
		)

		expect(
			screen.getByText(/not available for this organization/i)
		).not.toBeNull()
	})

	it('still shows the name and description', () => {
		render(<ApiKeyNameCell row={row({ description: 'Pasted into a page' })} />)

		expect(screen.getByText('Storefront key')).not.toBeNull()
		expect(screen.getByText('Pasted into a page')).not.toBeNull()
	})

	it('warns on the Status cell when a key is close to expiry', () => {
		/*
		  Rendered through the real column, not the cell helper, because the
		  warning lives in the Status column and the wiring is the part that can
		  silently not happen.
		*/
		const columns = createApiKeyColumns({
			onEdit: vi.fn(),
			onRevoke: vi.fn(),
			onRotate: vi.fn()
		})
		const status = columns.find(
			(column) => 'id' in column && column.id === 'status'
		)

		const soon = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
		render(
			(
				status!.cell as (context: {
					row: { original: ApiKeyRow }
				}) => ReactElement
			)({ row: { original: row({ expiresAt: soon }) } })
		)

		expect(screen.getByText(/expires in 3 days/i)).not.toBeNull()
	})

	it('says nothing about expiry on a key that is already dead', () => {
		/*
		  The contradiction the separate predicate exists to prevent: this row is
		  inside the warning window by date and revoked, so the badge already says
		  the useful thing and "expires in 3 days" would argue with it.
		*/
		const columns = createApiKeyColumns({
			onEdit: vi.fn(),
			onRevoke: vi.fn(),
			onRotate: vi.fn()
		})
		const status = columns.find(
			(column) => 'id' in column && column.id === 'status'
		)

		const soon = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
		render(
			(
				status!.cell as (context: {
					row: { original: ApiKeyRow }
				}) => ReactElement
			)({
				row: {
					original: row({
						expiresAt: soon,
						revokedAt: new Date('2026-02-01T00:00:00.000Z'),
						active: false,
						value: { readable: false, reason: 'revoked' }
					})
				}
			})
		)

		expect(screen.queryByText(/expires in/i)).toBeNull()
	})
})
