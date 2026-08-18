import { describe, expect, it } from 'vitest'

import {
	defaultShadowsOptions,
	normalizeShadowOptions
} from './viewer-defaults'

/**
 * `normalizeShadowOptions` is the only thing standing between persisted scene
 * JSON and the viewer, and the shapes it has to accept span three eras: rows
 * tagged `type: 'contact'` from when shadows were a discriminated union, rows
 * tagged `type: 'accumulative'` from the same era, and current saves that carry
 * no tag at all. The untagged case is the one worth pinning: reading it as
 * "unrecognized, reset to defaults" would silently discard every shadow setting
 * a user has made since the tag was dropped.
 */
describe('normalizeShadowOptions', () => {
	it('falls back to the defaults when nothing is stored', () => {
		expect(normalizeShadowOptions(undefined)).toEqual(defaultShadowsOptions)
	})

	it('keeps only the enabled flag from a legacy contact config', () => {
		const normalized = normalizeShadowOptions({
			type: 'contact',
			enabled: true,
			opacity: 0.5,
			scale: 10
		})

		expect(normalized).toEqual({ ...defaultShadowsOptions, enabled: true })
	})

	it('merges a legacy accumulative config over the defaults and drops the tag', () => {
		const normalized = normalizeShadowOptions({
			type: 'accumulative',
			enabled: true,
			opacity: 0.4
		})

		expect(normalized.opacity).toBe(0.4)
		expect(normalized.scale).toBe(defaultShadowsOptions.scale)
		expect(normalized).not.toHaveProperty('type')
	})

	it('merges an untagged config rather than resetting it', () => {
		const normalized = normalizeShadowOptions({ enabled: true, opacity: 0.4 })

		expect(normalized.opacity).toBe(0.4)
		expect(normalized.enabled).toBe(true)
	})

	it('fills in missing nested light and contact fields', () => {
		const normalized = normalizeShadowOptions({
			enabled: true,
			light: { ambient: 0.1 },
			contact: { enabled: true }
		})

		expect(normalized.light).toEqual({
			...defaultShadowsOptions.light,
			ambient: 0.1
		})
		expect(normalized.contact).toEqual({
			...defaultShadowsOptions.contact,
			enabled: true
		})
	})
})
