// @vitest-environment jsdom
/**
 * The panel sits inside the empty stage's dropzone, which opens every drop as a
 * 3D model. A drop on the panel must stay the panel's.
 *
 * jsdom has no constructible `FileList`, so an accepted image (which the panel
 * mirrors into its file field) is checked in the browser; here a drop the panel
 * ignores shows that no drop escapes it.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import { GenerateFromImage } from './generate-from-image'

import type { ImgTo3dGeneration } from '../../../hooks/use-img-to-3d-generation'
import type { ImgTo3dListedBatch } from '../../../lib/domain/img-to-3d/img-to-3d-contract'

const generation: ImgTo3dGeneration = {
	isSubmitting: false,
	submitError: null,
	opening: null,
	retryOpen: vi.fn(),
	generate: vi.fn()
}

const JOB = '00000000-0000-4000-8000-000000000002'

function listed(
	overrides: Partial<ImgTo3dListedBatch> = {}
): ImgTo3dListedBatch {
	return {
		batchId: 'batch',
		sourceName: 'chair',
		createdByName: 'Moritz',
		createdAt: '2026-11-13T10:00:00.000Z',
		keptUntil: '2026-11-20T10:00:00.000Z',
		expired: false,
		variants: [
			{ jobId: JOB, seed: 7, status: 'succeeded', progress: 100, error: null }
		],
		...overrides
	}
}

describe('GenerateFromImage', () => {
	it('keeps a drop on the panel from reaching the stage behind it', () => {
		const stageDrop = vi.fn()
		render(
			<MemoryRouter>
				<div onDrop={stageDrop} onDragOver={stageDrop} onDragEnter={stageDrop}>
					<GenerateFromImage generation={generation} batches={[]} />
				</div>
			</MemoryRouter>
		)
		const panel = screen.getByRole('region', {
			name: 'Generate from an image (internal)'
		})
		const dataTransfer = {
			files: [new File(['glb'], 'chair.glb', { type: 'model/gltf-binary' })]
		}

		fireEvent.dragEnter(panel, { dataTransfer })
		fireEvent.dragOver(panel, { dataTransfer })
		fireEvent.drop(panel, { dataTransfer })

		expect(stageDrop).not.toHaveBeenCalled()
		expect(screen.getByRole('button', { name: 'Generate' })).toBeDisabled()
	})
	it('leads to every generation, not only the ones this tab started', () => {
		render(
			<MemoryRouter>
				<GenerateFromImage generation={generation} batches={[]} />
			</MemoryRouter>
		)

		expect(
			screen.getByRole('link', { name: 'All generations' })
		).toHaveAttribute('href', '/dashboard/generations')
	})

	it('opens a ready variant by its URL, and downloads it without opening', () => {
		render(
			<MemoryRouter>
				<GenerateFromImage generation={generation} batches={[listed()]} />
			</MemoryRouter>
		)

		expect(screen.getByRole('link', { name: 'Open' })).toHaveAttribute(
			'href',
			`/publisher?generation=${JOB}`
		)
		expect(
			screen.getByRole('link', { name: 'Download chair-7.glb' })
		).toHaveAttribute('href', `/api/img-to-3d/generations/${JOB}/artifact`)
	})

	it('offers nothing to open from a batch past its 7 days', () => {
		render(
			<MemoryRouter>
				<GenerateFromImage
					generation={generation}
					batches={[listed({ expired: true })]}
				/>
			</MemoryRouter>
		)

		expect(screen.getByText('Expired: models are kept for 7 days')).toBeTruthy()
		expect(screen.queryByRole('link', { name: 'Open' })).toBeNull()
	})

	it('says why a variant did not open', () => {
		render(
			<MemoryRouter>
				<GenerateFromImage
					generation={{
						...generation,
						opening: { jobId: JOB, error: 'open_failed' }
					}}
					batches={[listed()]}
				/>
			</MemoryRouter>
		)

		expect(
			screen.getByText(
				'The model could not be opened. Trying again usually works.'
			)
		).toBeTruthy()
		// Its URL is already the open one, so only a retry can open it again.
		fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
		expect(generation.retryOpen).toHaveBeenCalledTimes(1)
	})
})
