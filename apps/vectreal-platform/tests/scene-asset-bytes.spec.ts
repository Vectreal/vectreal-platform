import {
	getSerializedAssetByteSize,
	toSerializedAssetBytes
} from '@vctrl/core'

describe('toSerializedAssetBytes', () => {
	it('returns Uint8Array data unchanged', () => {
		const bytes = new Uint8Array([1, 2, 3])
		const result = toSerializedAssetBytes({ data: bytes })
		expect(result).toBe(bytes)
	})

	it('still decodes base64 strings', () => {
		const result = toSerializedAssetBytes({ data: 'AQID', encoding: 'base64' })
		expect(Array.from(result)).toEqual([1, 2, 3])
	})

	it('still converts number arrays', () => {
		const result = toSerializedAssetBytes({ data: [4, 5, 6] })
		expect(Array.from(result)).toEqual([4, 5, 6])
	})
})

describe('getSerializedAssetByteSize', () => {
	it('returns byteLength for Uint8Array input', () => {
		expect(getSerializedAssetByteSize(new Uint8Array(10))).toBe(10)
	})

	it('still sizes number arrays and base64 strings', () => {
		expect(getSerializedAssetByteSize([1, 2, 3])).toBe(3)
		expect(getSerializedAssetByteSize('AQID')).toBe(3)
	})
})
