import { imgTo3dServerDeps } from '../../lib/domain/img-to-3d/img-to-3d-deps.server'
import { handleSubmitImgTo3dGeneration } from '../../lib/domain/img-to-3d/img-to-3d-handlers'

import type { Route } from './+types/img-to-3d.generations'

export const action = ({ request }: Route.ActionArgs) =>
	handleSubmitImgTo3dGeneration(request, imgTo3dServerDeps)
