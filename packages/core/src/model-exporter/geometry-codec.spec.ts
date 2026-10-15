import { describe, expect, it } from 'vitest'

import { gzipSize, pickGeometryCodec } from './geometry-codec'

describe('pickGeometryCodec', () => {
	it('keeps meshopt while it is within 15% of Draco', () => {
		expect(pickGeometryCodec({ none: 1000, meshopt: 574, draco: 500 })).toBe(
			'meshopt'
		)
		expect(pickGeometryCodec({ none: 1000, meshopt: 575, draco: 500 })).toBe(
			'meshopt'
		)
	})

	it('takes Draco once meshopt is more than 15% larger', () => {
		expect(pickGeometryCodec({ none: 1000, meshopt: 576, draco: 500 })).toBe(
			'draco'
		)
	})

	it('weighs Draco against plain geometry when meshopt does not help', () => {
		expect(pickGeometryCodec({ none: 560, meshopt: 600, draco: 500 })).toBe(
			'none'
		)
		expect(pickGeometryCodec({ none: 600, meshopt: 700, draco: 500 })).toBe(
			'draco'
		)
	})

	it('chooses between meshopt and plain when Draco was not measured', () => {
		expect(pickGeometryCodec({ none: 1000, meshopt: 999 })).toBe('meshopt')
		expect(pickGeometryCodec({ none: 1000, meshopt: 1000 })).toBe('none')
		expect(pickGeometryCodec({ none: 1000 })).toBe('none')
	})

	it('honours a different margin', () => {
		expect(
			pickGeometryCodec({ none: 1000, meshopt: 540, draco: 500 }, 0.05)
		).toBe('draco')
	})
})

describe('gzipSize', () => {
	it('measures repetitive bytes as smaller than they are', async () => {
		const bytes = new Uint8Array(4096).fill(7)
		expect(await gzipSize(bytes)).toBeLessThan(100)
	})
})
