// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'

import {
	isEditableEventTarget,
	resolveChromeKeyAction
} from './use-chrome-visibility'

function key(
	overrides: Partial<
		Pick<KeyboardEvent, 'key' | 'altKey' | 'ctrlKey' | 'metaKey'>
	>
) {
	return {
		key: 'a',
		altKey: false,
		ctrlKey: false,
		metaKey: false,
		...overrides
	}
}

describe('resolveChromeKeyAction', () => {
	it.each(['h', 'H'])('treats %s as a visibility toggle', (pressed) => {
		expect(resolveChromeKeyAction(key({ key: pressed }))).toBe('toggle')
	})

	it('treats Escape as leaving the preview', () => {
		expect(resolveChromeKeyAction(key({ key: 'Escape' }))).toBe('exit')
	})

	it('ignores unrelated keys', () => {
		expect(resolveChromeKeyAction(key({ key: 'k' }))).toBeNull()
	})

	// Cmd+H hides the window on macOS and Ctrl+H is a browser shortcut; the
	// chrome must not swallow either.
	it.each([
		['meta', { key: 'h', metaKey: true }],
		['ctrl', { key: 'h', ctrlKey: true }],
		['alt', { key: 'h', altKey: true }]
	])('ignores %s-modified h', (_label, overrides) => {
		expect(resolveChromeKeyAction(key(overrides))).toBeNull()
	})

	it('ignores modified Escape', () => {
		expect(
			resolveChromeKeyAction(key({ key: 'Escape', metaKey: true }))
		).toBeNull()
	})
})

describe('isEditableEventTarget', () => {
	it('returns false for a plain element', () => {
		expect(isEditableEventTarget(document.createElement('div'))).toBe(false)
	})

	it('returns false when there is no target', () => {
		expect(isEditableEventTarget(null)).toBe(false)
	})

	it.each(['input', 'textarea', 'select'])(
		'treats <%s> as editable so typing is never hijacked',
		(tagName) => {
			expect(isEditableEventTarget(document.createElement(tagName))).toBe(true)
		}
	)

	it('treats contenteditable as editable', () => {
		const element = document.createElement('div')
		element.contentEditable = 'true'
		// jsdom does not derive isContentEditable from the attribute.
		Object.defineProperty(element, 'isContentEditable', { value: true })

		expect(isEditableEventTarget(element)).toBe(true)
	})

	// Radix Select renders a button with listbox semantics, not a <select>, so
	// arrow and letter keys aimed at an open camera dropdown belong to it.
	it.each(['listbox', 'combobox'])(
		'treats a %s descendant as editable',
		(role) => {
			const wrapper = document.createElement('div')
			wrapper.setAttribute('role', role)
			const child = document.createElement('span')
			wrapper.appendChild(child)

			expect(isEditableEventTarget(child)).toBe(true)
		}
	)
})
