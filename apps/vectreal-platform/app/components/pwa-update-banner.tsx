import { Button } from '@shared/components/ui/button'
import { AnimatePresence, motion } from 'framer-motion'
import { RefreshCw, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Workbox } from 'workbox-window'

const SESSION_KEY = 'pwa-update-dismissed'

/**
 * Displays a non-intrusive update-available banner when a new service worker
 * version is waiting to activate. The banner lets users reload immediately or
 * dismiss without interrupting their current session.
 *
 * Registration uses workbox-window directly (not vite-plugin-pwa's virtual
 * module, which cannot generate a worker under React Router's SSR build). The
 * worker at /sw.js is produced by scripts/build-sw.mjs and only ever precaches
 * icons/fonts; it never intercepts navigations or per-user data.
 *
 * Dismissed state is persisted in sessionStorage so the banner does not
 * reappear within the same browser session after the user has dismissed it.
 *
 * This component must only be rendered on the client (never during SSR) because
 * it registers a service worker on mount. It is lazy-loaded from root.tsx so it
 * is excluded from the server bundle.
 */
export default function PwaUpdateBanner() {
	// Initialize to false and hydrate from sessionStorage in useEffect to avoid
	// accessing browser APIs during SSR or React's concurrent render init cycle.
	const [dismissed, setDismissed] = useState(false)
	const [needRefresh, setNeedRefresh] = useState(false)
	const wbRef = useRef<Workbox | null>(null)
	// Set when the user opts in to reload, so the `controlling` event only
	// reloads the page for a user-initiated update (never an external/other-tab
	// activation).
	const reloadingRef = useRef(false)

	useEffect(() => {
		if (sessionStorage.getItem(SESSION_KEY) === 'true') {
			setDismissed(true)
		}
	}, [])

	useEffect(() => {
		if (dismissed) {
			sessionStorage.setItem(SESSION_KEY, 'true')
		}
	}, [dismissed])

	useEffect(() => {
		// The worker is only built for production (scripts/build-sw.mjs); there is
		// no /sw.js in dev, so registering there just fails the request.
		if (import.meta.env.DEV) return
		if (!('serviceWorker' in navigator)) return

		const wb = new Workbox('/sw.js')
		wbRef.current = wb

		// A new worker is installed and waiting, so offer the reload.
		wb.addEventListener('waiting', () => setNeedRefresh(true))
		// The new worker took control after skipWaiting: reload once, only if the
		// user asked for it.
		wb.addEventListener('controlling', () => {
			if (reloadingRef.current) window.location.reload()
		})

		// Registration can still fail (insecure context, private mode, transient
		// network); the app works without the worker, so swallow it rather than
		// surface an unhandled rejection.
		wb.register().catch(() => {})

		return () => {
			wbRef.current = null
		}
	}, [])

	const applyUpdate = () => {
		reloadingRef.current = true
		wbRef.current?.messageSkipWaiting()
	}

	const show = needRefresh && !dismissed

	return (
		<AnimatePresence>
			{show && (
				<motion.div
					key="pwa-update-banner"
					initial={{ y: 80, opacity: 0 }}
					animate={{ y: 0, opacity: 1 }}
					exit={{ y: 80, opacity: 0 }}
					transition={{ duration: 0.25, ease: 'easeOut' }}
					className="bg-card/95 fixed right-4 bottom-4 z-50 flex max-w-sm items-center gap-3 rounded-2xl border p-4 shadow-lg backdrop-blur-sm"
					role="status"
					aria-live="polite"
					aria-label="App update available"
				>
					<div className="min-w-0 flex-1">
						<p className="text-sm font-medium">Update available</p>
						<p className="text-muted-foreground text-xs">
							Reload to get the latest version.
						</p>
					</div>
					<Button
						size="sm"
						onClick={applyUpdate}
						aria-label="Reload to apply update"
						className="shrink-0"
					>
						<RefreshCw className="mr-1.5 h-3.5 w-3.5" />
						Reload
					</Button>
					<Button
						variant="ghost"
						size="icon"
						onClick={() => setDismissed(true)}
						aria-label="Dismiss update notification"
						className="h-7 w-7 shrink-0"
					>
						<X className="h-3.5 w-3.5" />
					</Button>
				</motion.div>
			)}
		</AnimatePresence>
	)
}
