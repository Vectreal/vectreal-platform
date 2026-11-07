import { describe, expect, it } from 'vitest'

import { toVector3Tuple, withVectorTuples } from './scene-vector'

describe('toVector3Tuple', () => {
	it.each([
		['a tuple', [1, -2, 3.5]],
		['an object', { x: 1, y: -2, z: 3.5 }]
	])('stores %s as [x, y, z]', (_form, value) => {
		expect(toVector3Tuple(value)).toEqual([1, -2, 3.5])
	})

	it.each([
		['two components', [1, 2]],
		['four components', [1, 2, 3, 'XYZ']],
		['a string component', [1, '2', 3]],
		['an infinite component', [1, Infinity, 3]],
		['NaN', { x: Number.NaN, y: 0, z: 0 }],
		['a missing axis', { x: 1, y: 2 }],
		["three.js's serialized Euler", { _x: 0, _y: 1, _z: 0, _order: 'XYZ' }],
		['extra keys', { x: 1, y: 2, z: 3, w: 1 }],
		['a string', '1,2,3'],
		['null', null]
	])('refuses %s', (_form, value) => {
		expect(toVector3Tuple(value)).toBeNull()
	})
})

describe('withVectorTuples', () => {
	it('reads every camera vector in the object form as a tuple', () => {
		const camera = withVectorTuples({
			cameras: [
				{
					cameraId: 'hero',
					position: { x: 1, y: 2, z: 3 },
					target: [0, 0, 0],
					rotation: { x: 0, y: 1, z: 0 },
					lookAt: { x: 4, y: 5, z: 6 }
				}
			]
		})

		expect(camera.cameras[0]).toEqual({
			cameraId: 'hero',
			position: [1, 2, 3],
			target: [0, 0, 0],
			rotation: [0, 1, 0],
			lookAt: [4, 5, 6]
		})
	})

	it('leaves a value in neither form as stored', () => {
		const odd = { _x: 0, _y: 1, _z: 0, _order: 'XYZ' }

		const camera = withVectorTuples({
			cameras: [{ cameraId: 'hero', rotation: odd }]
		})

		expect(camera.cameras[0]).toEqual({ cameraId: 'hero', rotation: odd })
	})
})
