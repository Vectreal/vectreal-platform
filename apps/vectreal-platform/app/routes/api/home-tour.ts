import { ApiResponse } from '@shared/utils'

import { resolveHomeTour } from '../../lib/samples/home-tour-scene.server'

import type { Route } from './+types/home-tour'

/*
  The same answer for every visitor, so the browser may keep it a few minutes;
  a scene swapped in config reaches a returning visitor within that.
*/
const CACHE = { 'Cache-Control': 'public, max-age=300' }

/** The scene the home page's three-photos band tours, or 404 while none is configured. */
export async function loader({ request }: Route.LoaderArgs) {
	const scene = await resolveHomeTour(request)
	return scene
		? ApiResponse.success(scene, 200, { headers: CACHE })
		: ApiResponse.notFound('No home tour is configured.', { headers: CACHE })
}
