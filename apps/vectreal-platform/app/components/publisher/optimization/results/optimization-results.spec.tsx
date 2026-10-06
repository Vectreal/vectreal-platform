// @vitest-environment jsdom
/**
 * The optimization breakdown describes the file a publish actually shipped,
 * once there is one: the geometry codec the export chose and how many textures
 * went to KTX2, rather than the Draco and WebP projection made before it.
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { OptimizationResults } from './optimization-results'

import type { PublishedEncoding } from '../../../../types/scene-optimization'
import type { DracoCompressionReport } from '@vctrl/core'
import type { ComponentProps } from 'react'

const pair = (initial: number, current: number) => ({ initial, current })

const props = (
	publishedEncoding: PublishedEncoding | null
): ComponentProps<typeof OptimizationResults> => ({
	sizeInfo: {
		initial: 4_000_000,
		optimized: 1_000_000,
		workingSceneBytes: 1_400_000
	} as never,
	resolvedMetrics: {
		sceneBytes: pair(4_000_000, 1_000_000),
		textureBytes: pair(3_000_000, 600_000),
		primitives: pair(1000, 1000)
	} as never,
	dracoReport: {
		isWorthApplying: true,
		geometryBytesBefore: 800_000,
		geometryBytesAfterCompression: 200_000,
		reductionPercent: 75
	} as DracoCompressionReport,
	publishedEncoding,
	simplificationOutcome: null
})

describe('the optimization breakdown', () => {
	it('shows the Draco projection before anything is published', () => {
		render(<OptimizationResults {...props(null)} />)

		expect(screen.getByText('Geometry (Draco)')).toBeInTheDocument()
		expect(screen.getByText('Before Draco')).toBeInTheDocument()
		expect(screen.queryByText(/GPU-compressed/)).toBeNull()
	})

	it('describes the published geometry codec as it travels', () => {
		render(
			<OptimizationResults
				{...props({
					geometryCodec: 'meshopt',
					geometrySizes: { none: 409_600, meshopt: 102_400, draco: 92_160 }
				})}
			/>
		)

		const row = screen.getByText('Geometry (meshopt)').parentElement
		expect(row).toHaveTextContent('400 KB')
		expect(row).toHaveTextContent('100 KB')
		expect(row).toHaveTextContent('(-75%, gzipped)')
		expect(screen.queryByText('Geometry (Draco)')).toBeNull()
		expect(screen.queryByText('Before Draco')).toBeNull()
	})

	it('says when published geometry went uncompressed', () => {
		render(
			<OptimizationResults
				{...props({
					geometryCodec: 'none',
					geometrySizes: { none: 400_000, meshopt: 410_000 }
				})}
			/>
		)

		expect(
			screen.getByText('Geometry (uncompressed)').parentElement
		).toHaveTextContent('Not compressed')
	})

	it('counts the textures that shipped as KTX2', () => {
		render(
			<OptimizationResults
				{...props({
					geometryCodec: 'draco',
					geometrySizes: { none: 400_000, meshopt: 150_000, draco: 90_000 },
					ktx2Textures: { encoded: 3, total: 9 }
				})}
			/>
		)

		expect(screen.getByText('Texture size').parentElement).toHaveTextContent(
			'(3 of 9 GPU-compressed)'
		)
	})
})
