import { Button } from '@shared/components/ui/button'
import { AnimatePresence, motion } from 'framer-motion'
import { Link } from 'react-router'

import { useConsent, useNeedsBanner } from './consent-context'
import { CONSENT_POLICY_VERSION } from '../../constants/consent-policy'
import { duration } from '../../lib/motion/motion-tokens'

import type { ModelIntakeLocale } from '../../lib/domain/model-intake/model-intake-shared'

/*
  English everywhere but the German letter pages, where an English banner over
  a German page was the first thing a reader saw. The preferences dialog it
  opens stays English for now.
*/
const BANNER_COPY = {
	en: {
		label: 'Cookie consent',
		body: 'We use cookies and similar technologies to operate our platform and, with your consent, to understand how you use it. Read our',
		policy: 'Privacy Policy',
		after: 'to learn more.',
		manage: 'Manage preferences',
		manageLabel: 'Manage cookie preferences',
		reject: 'Reject all',
		rejectLabel: 'Reject all non-essential cookies',
		accept: 'Accept all',
		acceptLabel: 'Accept all cookies'
	},
	de: {
		label: 'Cookie-Einwilligung',
		body: 'Wir verwenden Cookies und ähnliche Technologien, um unsere Plattform zu betreiben und, mit Ihrer Einwilligung, zu verstehen, wie Sie sie nutzen. Mehr dazu in unserer',
		policy: 'Datenschutzerklärung',
		after: '',
		manage: 'Einstellungen',
		manageLabel: 'Cookie-Einstellungen verwalten',
		reject: 'Alle ablehnen',
		rejectLabel: 'Alle nicht notwendigen Cookies ablehnen',
		accept: 'Alle akzeptieren',
		acceptLabel: 'Alle Cookies akzeptieren'
	}
} as const satisfies Record<ModelIntakeLocale, Record<string, string>>

export function ConsentBanner({
	locale = 'en'
}: {
	locale?: ModelIntakeLocale
}) {
	const copy = BANNER_COPY[locale]
	const { saveConsent, setPreferencesOpen } = useConsent()
	const showBanner = useNeedsBanner(CONSENT_POLICY_VERSION)

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
					transition={{ duration: duration.base, ease: 'easeOut' }}
					className="ds-overlay z-nav fixed right-0 bottom-0 left-0 border-t py-4 shadow-lg backdrop-blur-sm"
					role="dialog"
					aria-modal="false"
					aria-label={copy.label}
					lang={locale}
				>
					<div className="container-page flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
						<p className="flex-1 text-sm leading-relaxed text-balance">
							{copy.body}{' '}
							<Link
								to="/privacy-policy"
								className="hover:text-foreground underline underline-offset-2"
							>
								{copy.policy}
							</Link>
							{copy.after ? ` ${copy.after}` : '.'}
						</p>

						<div className="flex shrink-0 flex-wrap gap-2">
							<Button
								variant="ghost"
								size="sm"
								onClick={() => setPreferencesOpen(true)}
								aria-label={copy.manageLabel}
							>
								{copy.manage}
							</Button>
							<Button
								variant="ghost"
								size="sm"
								onClick={handleRejectAll}
								aria-label={copy.rejectLabel}
							>
								{copy.reject}
							</Button>
							<Button
								size="sm"
								onClick={handleAcceptAll}
								aria-label={copy.acceptLabel}
							>
								{copy.accept}
							</Button>
						</div>
					</div>
				</motion.div>
			)}
		</AnimatePresence>
	)
}
