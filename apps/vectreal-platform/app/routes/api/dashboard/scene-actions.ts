import { data } from 'react-router'

import { SceneService } from '../../../lib/services/scene-service.server'

import { Route } from './+types/scene-actions'

interface Params {
	sceneId?: string
}

export const action = async ({ request, params }: Route.ActionArgs) => {
	// get params from request
	const { sceneId } = params as Params

	const formData = await request.formData()
	const action = formData.get('action')

	const sceneService = new SceneService()
	console.log('scene-actions action called with:', { sceneId, action })

	// Perform action based on the 'action' parameter

	switch (action) {
		case 'duplicate':
			// Handle duplicate action
			break
		case 'delete':
			// Handle delete action
			break
		default:
			throw new Error('Unknown action')
	}
	return data({
		success: true,
		message: 'Action completed successfully'
	})
}
