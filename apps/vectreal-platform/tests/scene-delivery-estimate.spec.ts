import { estimateDeliveryTime } from '../app/lib/domain/scene/scene-delivery-estimate'

const MB = 1_000_000

describe('estimateDeliveryTime', () => {
	it('scales linearly with size', () => {
		const small = estimateDeliveryTime(3 * MB)
		const large = estimateDeliveryTime(6 * MB)

		expect(large!.seconds).toBeCloseTo(small!.seconds * 2)
	})

	it('shows one decimal for short loads so improvements stay visible', () => {
		expect(estimateDeliveryTime(1.8 * MB)?.label).toBe('~1.2s')
	})

	it('rounds to whole seconds once the load is long', () => {
		expect(estimateDeliveryTime(30 * MB)?.label).toBe('~20s')
	})

	// A scene that exists always takes some time; "~0.0s" would read as free.
	it('never claims an instant load', () => {
		expect(estimateDeliveryTime(1)?.label).toBe('~0.1s')
	})

	it('flags a slow scene and leaves a quick one alone', () => {
		expect(estimateDeliveryTime(24 * MB)?.isSlow).toBe(true)
		expect(estimateDeliveryTime(2 * MB)?.isSlow).toBe(false)
	})

	it('returns null when there is no size to estimate from', () => {
		expect(estimateDeliveryTime(null)).toBeNull()
		expect(estimateDeliveryTime(undefined)).toBeNull()
		expect(estimateDeliveryTime(0)).toBeNull()
		expect(estimateDeliveryTime(Number.NaN)).toBeNull()
	})
})
