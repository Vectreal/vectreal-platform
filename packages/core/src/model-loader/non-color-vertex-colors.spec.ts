import { BufferAttribute, Float32BufferAttribute } from 'three'
import { describe, expect, it } from 'vitest'

import { carriesNoColor } from './non-color-vertex-colors'

/*
  The rule on its own. `parse-glb.spec.ts` drives it through a parse, but
  glTF-Transform writes interleaved attributes there, so a misread alpha lands
  on position data and the three-component case cannot fail from that side.
*/
describe('whether a COLOR_0 carries color', () => {
	it('reads near-zero alpha on every vertex as no color', () => {
		const color = new Float32BufferAttribute(
			[0.3, 0.3, 0.3, 0, 0.3, 0.3, 0.3, 16 / 255],
			4
		)

		expect(carriesNoColor(color)).toBe(true)
	})

	it('reads one vertex with real alpha as color', () => {
		const color = new Float32BufferAttribute(
			[0.3, 0.3, 0.3, 0, 0.3, 0.3, 0.3, 0.5],
			4
		)

		expect(carriesNoColor(color)).toBe(false)
	})

	it('reads dark colors with no alpha component as color', () => {
		const color = new Float32BufferAttribute(
			[0.05, 0.05, 0.05, 0.05, 0.05, 0.05],
			3
		)

		expect(carriesNoColor(color)).toBe(false)
	})

	it('reads alpha through normalization, as an 8-bit COLOR_0 stores it', () => {
		const color = new BufferAttribute(
			new Uint8Array([80, 80, 80, 16, 80, 80, 80, 0]),
			4,
			true
		)

		expect(carriesNoColor(color)).toBe(true)
	})
})
