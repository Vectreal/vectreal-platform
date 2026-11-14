import { ApiResponse } from '@shared/utils'

import { resolveHomeTour } from '../../lib/samples/home-tour-scene.server'

import type { Route } from './+types/home-tour'

/*
  A found scene is the same answer for every visitor, so the browser may keep
  it a few minutes; a scene swapped in config reaches a returning visitor
  within that. "None" is never kept: it also stands for a lookup that failed
  for a moment, and a kept miss would hide the tour after the failure passed.
*/
const FOUND_CACHE = { 'Cache-Control': 'public, max-age=300' }

/** The scene the home page's three-photos band tours, or 404 while there is none. */
export async function loader({ request }: Route.LoaderArgs) {
	const scene = await resolveHomeTour(request)
	return scene
		? ApiResponse.success(scene, 200, { headers: FOUND_CACHE })
		: ApiResponse.notFound('No home tour is configured.')
}
