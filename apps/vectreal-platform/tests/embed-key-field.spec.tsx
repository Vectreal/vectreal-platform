// @vitest-environment jsdom
/**
 * The key picker's empty message, on the same terms as its sibling.
 *
 * This exact guard - zero results read as "confirmed empty" rather than "not
 * known yet" - was found four times in this change, in two mirrored call sites.
 * The panel's copy of it is covered by `embed-options-panel.spec.ts`; this is
 * the other half, so a fifth instance cannot land in whichever one nobody
 * tested.
 */

import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { EmbedKeyField } from '../app/components/embed/embed-key-field'
import { EMBED_COPY } from '../app/lib/domain/embed/embed-snippet'

import type { EmbedApiKeysApi } from '../app/components/embed/use-embed-api-keys'

let api: EmbedApiKeysApi

beforeEach(() => {
	api = {
		keys: [],
		allowedDomains: [],
		canCreateKey: true,
		hasLoaded: true,
		loadError: null,
		token: '',
		setToken: vi.fn(),
		selectedKeyId: '',
		selectKey: vi.fn(),
		createdKey: null,
		dismissCreatedKey: vi.fn(),
		createKey: vi.fn(),
		creating: false,
		createError: null
	}
})

const emptyMessage = () => screen.queryByText(EMBED_COPY.keyPickerEmpty)

describe('the key picker empty message', () => {
	it('appears once the project is known to have no keys', () => {
		render(<EmbedKeyField api={api} />)

		expect(emptyMessage()).not.toBeNull()
	})

	it('says nothing before an answer has arrived', () => {
		render(<EmbedKeyField api={{ ...api, hasLoaded: false }} />)

		expect(emptyMessage()).toBeNull()
	})

	it('says nothing when the keys could not be read', () => {
		render(
			<EmbedKeyField
				api={{
					...api,
					loadError: 'You do not have permission to view API keys'
				}}
			/>
		)

		expect(emptyMessage()).toBeNull()
		expect(
			screen.getByText('You do not have permission to view API keys')
		).not.toBeNull()
	})
})
