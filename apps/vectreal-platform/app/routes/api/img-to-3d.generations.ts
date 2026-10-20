import { imgTo3dServerDeps } from '../../lib/domain/img-to-3d/img-to-3d-deps.server'
import { handleSubmitImgTo3dGeneration } from '../../lib/domain/img-to-3d/img-to-3d-handlers'

import type { Route } from './+types/img-to-3d.generations'

// Both exports, so every method reaches the gate and a refused caller gets a
// 404 rather than React Router's own answer for a missing loader.
export const loader = ({ request }: Route.LoaderArgs) =>
	handleSubmitImgTo3dGeneration(request, imgTo3dServerDeps)

export const action = ({ request }: Route.ActionArgs) =>
	handleSubmitImgTo3dGeneration(request, imgTo3dServerDeps)
