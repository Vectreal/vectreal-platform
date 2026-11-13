/**
 * The viewer's keys: arrows orbit, Shift and arrows pan, plus and minus zoom,
 * Home goes back to the camera in use, each only while its flag allows it.
 */
import { PerspectiveCamera, Vector3 } from 'three'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
	applyViewerKey,
	describeViewerKeys,
	PAN_STEP,
	resolveViewerKeys,
	ROTATE_STEP,
	ZOOM_STEP,
	type ViewerKeys
} from './viewer-keys'
import { de } from '../../locales/de'
import { en } from '../../locales/en'

const ALL: ViewerKeys = { rotate: true, zoom: true, pan: true, home: true }
const NONE: ViewerKeys = { rotate: false, zoom: false, pan: false, home: false }

const press = (key: string, modifiers: Partial<KeyboardEvent> = {}) => ({
	key,
	shiftKey: false,
	ctrlKey: false,
	metaKey: false,
	altKey: false,
	...modifiers
})

function makeControls() {
	const object = new PerspectiveCamera()
	object.position.set(0, 0, 10)
	object.lookAt(0, 0, 0)
	object.updateMatrix()
	const angles = { azimuth: 1, polar: 1 }
	return {
		object,
		target: new Vector3(),
		getDistance: () => object.position.length(),
		getAzimuthalAngle: () => angles.azimuth,
		setAzimuthalAngle: vi.fn((value: number) => (angles.azimuth = value)),
		getPolarAngle: () => angles.polar,
		setPolarAngle: vi.fn((value: number) => (angles.polar = value)),
		dollyIn: vi.fn(),
		dollyOut: vi.fn(),
		update: vi.fn(),
		angles
	}
}

let controls: ReturnType<typeof makeControls>
let returnHome: ReturnType<typeof vi.fn<() => void>>

beforeEach(() => {
	controls = makeControls()
	returnHome = vi.fn<() => void>()
})

const apply = (key: string, keys = ALL, modifiers?: Partial<KeyboardEvent>) =>
	applyViewerKey(press(key, modifiers), controls, keys, returnHome)

describe('arrow keys orbit', () => {
	it.each([
		['ArrowLeft', -ROTATE_STEP, 0],
		['ArrowRight', ROTATE_STEP, 0],
		['ArrowUp', 0, -ROTATE_STEP],
		['ArrowDown', 0, ROTATE_STEP]
	])('%s turns the camera the way it points', (key, azimuth, polar) => {
		expect(apply(key)).toBe(true)
		expect(controls.angles.azimuth).toBeCloseTo(1 + azimuth)
		expect(controls.angles.polar).toBeCloseTo(1 + polar)
	})

	it('are left to the page while rotation is off', () => {
		expect(apply('ArrowLeft', { ...ALL, rotate: false })).toBe(false)
		expect(controls.setAzimuthalAngle).not.toHaveBeenCalled()
	})
})

describe('Shift and arrow keys pan', () => {
	it('slide the camera and its target together, and turn nothing', () => {
		expect(apply('ArrowLeft', ALL, { shiftKey: true })).toBe(true)
		const step = 10 * PAN_STEP
		expect(controls.object.position.x).toBeCloseTo(-step)
		expect(controls.target.x).toBeCloseTo(-step)
		expect(controls.object.position.z).toBeCloseTo(10)
		expect(controls.setAzimuthalAngle).not.toHaveBeenCalled()
		expect(controls.update).toHaveBeenCalled()
	})

	it('go up with the arrow', () => {
		apply('ArrowUp', ALL, { shiftKey: true })
		expect(controls.target.y).toBeCloseTo(10 * PAN_STEP)
	})

	it('are left to the page while panning is off, and do not orbit instead', () => {
		expect(apply('ArrowLeft', { ...ALL, pan: false }, { shiftKey: true })).toBe(
			false
		)
		expect(controls.target.x).toBe(0)
		expect(controls.setAzimuthalAngle).not.toHaveBeenCalled()
	})
})

describe('plus and minus zoom', () => {
	it.each(['+', '='])('%s moves closer', (key) => {
		expect(apply(key)).toBe(true)
		expect(controls.dollyIn).toHaveBeenCalledWith(ZOOM_STEP)
	})

	it('minus moves away', () => {
		expect(apply('-')).toBe(true)
		expect(controls.dollyOut).toHaveBeenCalledWith(ZOOM_STEP)
	})

	it('are left to the page while zoom is off', () => {
		expect(apply('+', { ...ALL, zoom: false })).toBe(false)
		expect(apply('-', { ...ALL, zoom: false })).toBe(false)
		expect(controls.dollyIn).not.toHaveBeenCalled()
		expect(controls.dollyOut).not.toHaveBeenCalled()
	})
})

describe('Home', () => {
	it('goes back to the camera in use', () => {
		expect(apply('Home')).toBe(true)
		expect(returnHome).toHaveBeenCalledOnce()
	})

	it('is left to the page when there is nowhere to go back to', () => {
		expect(apply('Home', { ...ALL, home: false })).toBe(false)
		expect(returnHome).not.toHaveBeenCalled()
	})
})

it.each([{ ctrlKey: true }, { metaKey: true }, { altKey: true }])(
	'leaves a browser shortcut to the browser (%o)',
	(modifiers) => {
		expect(apply('+', ALL, modifiers)).toBe(false)
		expect(apply('ArrowLeft', ALL, modifiers)).toBe(false)
		expect(controls.dollyIn).not.toHaveBeenCalled()
		expect(controls.setAzimuthalAngle).not.toHaveBeenCalled()
	}
)

it('takes no other key', () => {
	expect(apply('a')).toBe(false)
	expect(apply(' ')).toBe(false)
})

describe('resolveViewerKeys', () => {
	it('offers every key by default', () => {
		expect(resolveViewerKeys({}, { canReturnHome: true })).toEqual(ALL)
	})

	it('follows each flag the pointer follows', () => {
		expect(
			resolveViewerKeys(
				{ enableRotate: false, enableZoom: false, enablePan: false },
				{ canReturnHome: true }
			)
		).toEqual({ ...NONE, home: true })
	})

	it('offers nothing while the controls are off', () => {
		expect(
			resolveViewerKeys({ enabled: false }, { canReturnHome: true })
		).toEqual(NONE)
	})

	it('offers Home only with a camera to go back to', () => {
		expect(resolveViewerKeys({}, { canReturnHome: false }).home).toBe(false)
	})
})

describe('describeViewerKeys', () => {
	it('names every key on offer', () => {
		expect(describeViewerKeys(ALL, en)).toBe(
			'Arrow keys rotate the view. Shift and arrow keys pan. Plus and minus zoom. Home resets the view.'
		)
	})

	it('speaks German for a German scene', () => {
		expect(describeViewerKeys(ALL, de)).toBe(
			'Die Pfeiltasten drehen die Ansicht. Umschalt und Pfeiltasten verschieben die Ansicht. Plus und Minus zoomen. Pos1 setzt die Ansicht zurück.'
		)
	})

	it('names only the keys on offer', () => {
		expect(describeViewerKeys({ ...NONE, zoom: true }, en)).toBe(
			'Plus and minus zoom.'
		)
		expect(describeViewerKeys(NONE, de)).toBe('')
	})
})
