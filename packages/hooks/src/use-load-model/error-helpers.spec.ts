/**
 * Which failure a load reports, which is what decides the sentence the reader
 * gets.
 *
 * This module had no spec while two normalizers routed every load failure in
 * the product, and both of them classified "the model names files that did not
 * come with it" by matching prose. The local one matched the scene payload
 * builder's wording, so the glTF loader's own refusal was filed as a parse
 * failure; the server one matched nothing at all, so an incomplete manifest was
 * filed as a network problem and the reader was told to retry something that
 * could never succeed. In both cases the copy naming the real problem was
 * written, shipped, and unreachable.
 *
 * Mutation gates, all executed:
 *  - `isMissingAssetsError(error) ? 'missing_assets' : code` back to `code` in
 *    `normalizeLocalLoadError` and the local case goes red;
 *  - the same in `normalizeServerLoadError` and the server case goes red;
 *  - take the walk's `if (!(current instanceof Error)) return false` to
 *    `return true` - a chain that runs out counted as the refusal - and the
 *    local ordinary-failure case goes red. Only that one: the server case is
 *    held green by the `Server responded with 404` branch, which overwrites the
 *    derived code, so what gates it is breaking that branch instead. Not the
 *    `return false` after the loop either: that is reached only by a chain
 *    sixteen deep and kills nothing, which is what this bullet claimed until it
 *    was measured;
 *  - `current = current.cause` to `current = undefined` and the wrapped case
 *    goes red, which is the whole reason the marker is not just a message.
 */
import { missingAssetsError } from '@vctrl/core/model-loader'
import { describe, expect, it } from 'vitest'

import {
	normalizeLocalLoadError,
	normalizeServerLoadError
} from './error-helpers'

describe('a load that failed because files were missing says so', () => {
	it('reports a local refusal as missing_assets, through its wrapper', () => {
		/*
		  Wrapped twice, the way `loadFromFileObject` wraps it, because a marker
		  the walk cannot reach is no better than the prose it replaced.
		*/
		const refusal = new Error('Failed to load model from File object', {
			cause: new Error('Failed to load GLTF with assets', {
				cause: missingAssetsError('Missing required image files:\nbody.png')
			})
		})

		expect(normalizeLocalLoadError(refusal, 'gltf_load_failed').code).toBe(
			'missing_assets'
		)
	})

	it('reports an incomplete saved scene as missing_assets, not as the network', () => {
		/*
		  `resolve-scene-payload` refuses a manifest that omits a referenced
		  asset. That used to arrive as `server_load_failed`, so the dashboard
		  said "a server or network issue. Retry in a moment." about a payload
		  that will never load however often it is fetched.
		*/
		const refusal = missingAssetsError(
			'Scene payload is missing required referenced assets: wood.png'
		)

		expect(normalizeServerLoadError(refusal, 'scene-1').code).toBe(
			'missing_assets'
		)
	})
})

describe('an ordinary failure keeps its own code', () => {
	it('leaves a local parse failure as a parse failure', () => {
		const parse = new Error('Unexpected token < in JSON at position 0')

		expect(normalizeLocalLoadError(parse, 'gltf_load_failed').code).toBe(
			'gltf_load_failed'
		)
	})

	it('leaves a server failure to the status it reported', () => {
		const missing = new Error('Server responded with 404')

		expect(normalizeServerLoadError(missing, 'scene-1').code).toBe('not_found')
	})
})
