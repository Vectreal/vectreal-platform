import { imgTo3dServerDeps } from '../../lib/domain/img-to-3d/img-to-3d-deps.server'
import { handleImgTo3dGenerationArtifact } from '../../lib/domain/img-to-3d/img-to-3d-handlers'

import type { Route } from './+types/img-to-3d.generations.$jobId.artifact'

export const loader = ({ request, params }: Route.LoaderArgs) =>
	handleImgTo3dGenerationArtifact(request, params.jobId, imgTo3dServerDeps)
