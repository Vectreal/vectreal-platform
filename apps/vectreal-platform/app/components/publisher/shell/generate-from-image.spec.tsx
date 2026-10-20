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
import { describe, expect, it, vi } from 'vitest'

import { GenerateFromImage } from './generate-from-image'

import type { ImgTo3dGeneration } from '../../../hooks/use-img-to-3d-generation'

const generation: ImgTo3dGeneration = {
	candidates: [],
	isSubmitting: false,
	submitError: null,
	loadingJobId: null,
	generate: vi.fn(),
	loadCandidate: vi.fn()
}

describe('GenerateFromImage', () => {
	it('keeps a drop on the panel from reaching the stage behind it', () => {
		const stageDrop = vi.fn()
		render(
			<div onDrop={stageDrop} onDragOver={stageDrop} onDragEnter={stageDrop}>
				<GenerateFromImage generation={generation} />
			</div>
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
})
