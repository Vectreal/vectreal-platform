/**
 * The guard that stops a future key kind inheriting "show it".
 *
 * Nothing exercises the false branch today, and that is the point: every row is
 * an `embed` key, so this is a rule written before it is needed rather than
 * after something leaked. What the tests pin is the *shape* that makes the
 * eventual second kind a decision - a total map that fails to compile until
 * someone writes its rule, rather than an `if` a new value falls through.
 */

import { describe, expect, it } from 'vitest'

import {
	isApiKeyKindDisclosable,
	KIND_IS_DISCLOSABLE
} from './api-key-disclosure'
import { apiKeyKindEnum } from '../../../db/schema/auth/api-keys'

describe('API key disclosure', () => {
	it('lets an embed token be read back', () => {
		/*
		  It is published by construction - `buildEmbedUrl` puts it in an
		  `iframe src` on the customer's own page - so hiding it from the owner who
		  minted it bought nothing.
		*/
		expect(isApiKeyKindDisclosable('embed')).toBe(true)
	})

	it('has a rule for every kind the column can hold', () => {
		/*
		  The assertion that makes the map load-bearing. A kind added to the enum
		  without a rule is a compile error, and this catches the other direction:
		  a rule quietly deleted, or a map that stopped being total.
		*/
		expect(Object.keys(KIND_IS_DISCLOSABLE).sort()).toEqual(
			[...apiKeyKindEnum.enumValues].sort()
		)
	})

	it('refuses any kind that is not marked disclosable', () => {
		/*
		  Driven through a cast because no such kind exists yet. Without this the
		  function could `return true` outright and every test above would pass -
		  which is exactly the failure the map is meant to prevent, so it has to be
		  checkable before the second kind arrives, not after.
		*/
		const future = 'server-write' as (typeof apiKeyKindEnum.enumValues)[number]

		expect(isApiKeyKindDisclosable(future)).toBeFalsy()
	})
})
