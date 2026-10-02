import { randomInt, randomUUID } from 'node:crypto'

import { resolveImgTo3dAccess } from './img-to-3d-access.server'
import { IMG_TO_3D_MAX_SEED } from './img-to-3d-contract'
import { imgTo3dJobStore } from './img-to-3d-job-repository.server'
import { getImgTo3dRuntime } from './img-to-3d-runtime-client.server'
import { getAuthUser } from '../../http/auth.server'
import { ensureValidCsrfFormData } from '../../http/csrf.server'

import type { ImgTo3dHandlerDeps } from './img-to-3d-handlers'

/** What the image-to-3D routes run with. Specs pass their own. */
export const imgTo3dServerDeps: ImgTo3dHandlerDeps = {
	authenticate: getAuthUser,
	resolveAccess: resolveImgTo3dAccess,
	validateCsrf: ensureValidCsrfFormData,
	jobs: imgTo3dJobStore,
	runtime: getImgTo3dRuntime,
	newId: randomUUID,
	newSeed: () => randomInt(0, IMG_TO_3D_MAX_SEED + 1)
}
