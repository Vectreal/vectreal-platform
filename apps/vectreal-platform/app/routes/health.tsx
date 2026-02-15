import { data, type LoaderFunctionArgs } from 'react-router'

/**
 * Health check endpoint for Cloud Run and monitoring systems.
 * Returns 200 OK if the application is running and healthy.
 */
export async function loader({ request: _request }: LoaderFunctionArgs) {
	try {
		// Basic health check - can be extended to check database connectivity, etc.
		const health = {
			status: 'healthy',
			timestamp: new Date().toISOString(),
			environment: process.env.ENVIRONMENT || 'unknown'
		}

		return data(health, {
			status: 200,
			headers: {
				'Content-Type': 'application/json',
				'Cache-Control': 'no-cache, no-store, must-revalidate'
			}
		})
	} catch (error) {
		// If anything fails, return unhealthy status
		return data(
			{
				status: 'unhealthy',
				timestamp: new Date().toISOString(),
				error: error instanceof Error ? error.message : 'Unknown error'
			},
			{
				status: 503,
				headers: {
					'Content-Type': 'application/json',
					'Cache-Control': 'no-cache, no-store, must-revalidate'
				}
			}
		)
	}
}
