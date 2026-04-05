import { Button } from '@shared/components/ui/button'
import { AnimatePresence, motion } from 'framer-motion'
import { Link } from 'react-router'

import { useConsent, useNeedsBanner } from './consent-context'
import { CONSENT_POLICY_VERSION } from '../../lib/consent/consent-policy'

export function ConsentBanner() {
	const { saveConsent, setPreferencesOpen } = useConsent()
	const showBanner = useNeedsBanner(CONSENT_POLICY_VERSION)

	if (!showBanner) return null

	function handleAcceptAll() {
		saveConsent({ functional: true, analytics: true, marketing: true })
	}

	function handleRejectAll() {
		saveConsent({ functional: false, analytics: false, marketing: false })
	}

	return (
		<AnimatePresence>
			{showBanner && (
				<motion.div
					key="consent-banner"
					initial={{ y: 80, opacity: 0 }}
					animate={{ y: 0, opacity: 1 }}
					exit={{ y: 80, opacity: 0 }}
					transition={{ duration: 0.25, ease: 'easeOut' }}
					className="bg-card/95 fixed right-0 bottom-0 left-0 z-50 border-t px-4 py-4 shadow-lg backdrop-blur-sm sm:px-6"
					role="dialog"
					aria-modal="false"
					aria-label="Cookie consent"
				>
					<div className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
						<p className="flex-1 text-sm leading-relaxed text-balance">
							We use cookies and similar technologies to operate our platform
							and, with your consent, to understand how you use it. Read our{' '}
							<Link
								to="/privacy-policy"
								className="hover:text-foreground underline underline-offset-2"
							>
								Privacy Policy
							</Link>{' '}
							to learn more.
						</p>

						<div className="flex shrink-0 flex-wrap gap-2">
							<Button
								variant="outline"
								size="sm"
								onClick={() => setPreferencesOpen(true)}
								aria-label="Manage cookie preferences"
							>
								Manage preferences
							</Button>
							<Button
								variant="outline"
								size="sm"
								onClick={handleRejectAll}
								aria-label="Reject all non-essential cookies"
							>
								Reject all
							</Button>
							<Button
								size="sm"
								onClick={handleAcceptAll}
								aria-label="Accept all cookies"
							>
								Accept all
							</Button>
						</div>
					</div>
				</motion.div>
			)}
		</AnimatePresence>
	)
}
