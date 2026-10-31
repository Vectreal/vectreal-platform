import '@vctrl/viewer/css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import App from './App'

declare global {
	interface Window {
		__VIEWER_E2E__?: {
			status: 'mounted' | 'crashed'
			error?: string
		}
		__VIEWER_READY__?: boolean
		__HOOKS_E2E__?: { status: 'ok' | 'crashed'; error?: string }
		__SRC_E2E__?: {
			status: 'loaded' | 'error'
			meshes?: number
			error?: string
		}
		__SRC_READY__?: boolean
		__SRC_MISSING__?: string[]
		__BAKE_E2E__?:
			| {
					status: 'baked'
					baked: string[]
					skipped: string[]
					under: number
					beside: number
					far: number
					mirrored: number
					canopy: number
					storedPng: boolean
			  }
			| { status: 'error'; error: string }
	}
}

// Surface any uncaught runtime error to the e2e harness via a window flag.
window.addEventListener('error', (event) => {
	window.__VIEWER_E2E__ = {
		status: 'crashed',
		error: event.message
	}
})
window.addEventListener('unhandledrejection', (event) => {
	window.__VIEWER_E2E__ = {
		status: 'crashed',
		error: String(event.reason)
	}
})

createRoot(document.getElementById('root')!).render(
	<StrictMode>
		<App />
	</StrictMode>
)
