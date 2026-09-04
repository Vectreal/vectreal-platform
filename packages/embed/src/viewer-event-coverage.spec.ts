/**
 * Every viewer event the SDK can receive has a case that re-emits it.
 *
 * `handleViewerEvent` is a hand-maintained switch over a union declared in a
 * different package. A member added there and forgotten here is dropped
 * silently: the message crosses the iframe boundary, parses, and reaches a
 * `switch` with no matching case and no default, so nothing fails and nothing
 * arrives. That is the same silent-drop shape `isViewerCommand`'s own comment
 * warns about, one direction over.
 *
 * A name match, not a semantic one. It cannot tell a correct re-emission from
 * a wrong one; it can tell a handled event from an unhandled one, which is the
 * failure that has no other symptom.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const viewerTypes = readFileSync(
	join(import.meta.dirname, '../../viewer/src/types/viewer-interactions.ts'),
	'utf8'
)
const embed = readFileSync(join(import.meta.dirname, 'embed.ts'), 'utf8')

const handleViewerEvent = embed
	.split('private handleViewerEvent')[1]
	?.split('\n\t}')[0]

/** Every `type: '...'` literal declared on an interaction-event interface. */
const eventTypes = [
	...viewerTypes.matchAll(
		/export interface \w+InteractionEvent \{\n\ttype: '(\w+)'/g
	)
].map((match) => match[1])

describe('handleViewerEvent', () => {
	it('found the union and the switch to compare', () => {
		// Without this the two reads could yield nothing and every assertion
		// below would pass over an empty list.
		expect(eventTypes.length).toBeGreaterThan(5)
		expect(handleViewerEvent).toBeTruthy()
	})

	it.each(eventTypes)('re-emits %s', (type) => {
		expect(handleViewerEvent).toContain(`case '${type}':`)
	})
})
