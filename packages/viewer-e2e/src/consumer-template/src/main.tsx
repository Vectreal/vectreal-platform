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
