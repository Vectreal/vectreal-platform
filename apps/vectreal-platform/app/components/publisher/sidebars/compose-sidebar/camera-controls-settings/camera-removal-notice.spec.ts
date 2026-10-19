import { describeCameraRemoval } from './camera-removal-notice'

describe('describeCameraRemoval', () => {
	it('says nothing when the camera took nothing with it', () => {
		expect(describeCameraRemoval([], 0)).toBeNull()
	})

	it('names one hotspot', () => {
		expect(describeCameraRemoval(['Knob'], 0)).toBe(
			'Camera deleted. "Knob" no longer has a camera.'
		)
	})

	it('lists several hotspots', () => {
		expect(describeCameraRemoval(['Knob', 'Lens', 'Strap'], 0)).toBe(
			'Camera deleted. "Knob", "Lens" and "Strap" no longer have a camera.'
		)
	})

	it('counts interactions', () => {
		expect(describeCameraRemoval([], 2)).toBe(
			'Camera deleted. 2 interactions no longer switch to it.'
		)
	})

	it('reports both together', () => {
		expect(describeCameraRemoval(['Knob', 'Lens'], 1)).toBe(
			'Camera deleted. "Knob" and "Lens" no longer have a camera. 1 interaction no longer switches to it.'
		)
	})
})
