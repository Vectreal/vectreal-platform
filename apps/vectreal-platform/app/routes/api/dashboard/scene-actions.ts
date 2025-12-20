import { data } from 'react-router'

import { Route } from './+types/scene-actions'

export const action = async ({ request }: Route.ActionArgs) => {
	// get params from request

	const formData = await request.formData()
	const action = formData.get('action')

	// Perform action based on the  from '@shared/ui' parameter
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
