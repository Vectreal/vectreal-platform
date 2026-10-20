import { imgTo3dServerDeps } from '../../lib/domain/img-to-3d/img-to-3d-deps.server'
import { handleImgTo3dGenerationStatus } from '../../lib/domain/img-to-3d/img-to-3d-handlers'

import type { Route } from './+types/img-to-3d.generations.$jobId'

// Both exports, so every method reaches the gate: see img-to-3d.generations.ts.
export const loader = ({ request, params }: Route.LoaderArgs) =>
	handleImgTo3dGenerationStatus(request, params.jobId, imgTo3dServerDeps)

export const action = ({ request, params }: Route.ActionArgs) =>
	handleImgTo3dGenerationStatus(request, params.jobId, imgTo3dServerDeps)
