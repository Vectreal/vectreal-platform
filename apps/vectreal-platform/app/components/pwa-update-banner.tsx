import { Button } from '@shared/components/ui/button'
import { AnimatePresence, motion } from 'framer-motion'
import { RefreshCw, X } from 'lucide-react'
import { useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

/**
 * Displays a non-intrusive update-available banner when a new service worker
 * version is waiting to activate. The banner lets users reload immediately or
 * dismiss without interrupting their current session.
 *
 * This component must only be rendered on the client (never during SSR) because
 * it imports `virtual:pwa-register/react`, a Vite build-time virtual module
 * that is unavailable in the Node.js server bundle. Use the `ClientOnly` wrapper
 * from `remix-utils` and React `lazy()` to enforce that boundary.
 */
export default function PwaUpdateBanner() {
	const [dismissed, setDismissed] = useState(false)
	const {
		needRefresh: [needRefresh],
		updateServiceWorker
	} = useRegisterSW()

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
						onClick={() => updateServiceWorker(true)}
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
