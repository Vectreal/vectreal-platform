import { Button } from '@shared/components/ui/button'
import { cn } from '@shared/utils'
import { AnimatePresence, motion } from 'framer-motion'
import { Link } from 'react-router'

import { useConsent, useNeedsBanner } from './consent-context'
import { CONSENT_POLICY_VERSION } from '../../constants/consent-policy'
import { duration } from '../../lib/motion/motion-tokens'

import type { ModelIntakeLocale } from '../../lib/domain/model-intake/model-intake-shared'

/*
  English everywhere but the German letter pages, where an English banner over
  a German page was the first thing a reader saw. On the letter pages a phone
  gets the short text: the full one covered a third of the first screen.
*/
const BANNER_COPY = {
	en: {
		label: 'Cookie consent',
		body: 'We use cookies and similar technologies to operate our platform and, with your consent, to understand how you use it. Read our',
		short: 'Cookies to run the site and, with your consent, for analytics.',
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
		body: 'Diese Website verwendet Cookies und ähnliche Technologien, um sie zu betreiben und, mit Ihrer Einwilligung, zu verstehen, wie sie genutzt wird. Mehr dazu in der',
		short:
			'Cookies für den Betrieb und, mit Ihrer Einwilligung, für Statistik.',
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
	locale = 'en',
	compact = false
}: {
	locale?: ModelIntakeLocale
	/** The short text on a phone: the letter pages, where the first screen is the page's whole case. */
	compact?: boolean
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
					className={cn(
						'ds-overlay z-nav fixed right-0 bottom-0 left-0 border-t shadow-lg backdrop-blur-sm',
						compact ? 'py-2.5 sm:py-4' : 'py-4'
					)}
					role="dialog"
					aria-modal="false"
					aria-label={copy.label}
					lang={locale}
				>
					<div
						className={cn(
							'container-page flex flex-col sm:flex-row sm:items-center sm:gap-6',
							compact ? 'gap-2' : 'gap-4'
						)}
					>
						{compact ? (
							<p className="text-sm leading-snug text-balance sm:hidden">
								{copy.short}{' '}
								<Link
									to="/privacy-policy"
									className="hover:text-foreground underline underline-offset-2"
								>
									{copy.policy}
								</Link>
							</p>
						) : null}
						<p
							className={cn(
								'flex-1 text-sm leading-relaxed text-balance',
								compact && 'hidden sm:block'
							)}
						>
							{copy.body}{' '}
							<Link
								to="/privacy-policy"
								className="hover:text-foreground underline underline-offset-2"
							>
								{copy.policy}
							</Link>
							{copy.after ? ` ${copy.after}` : '.'}
						</p>

						<div
							className={cn(
								'flex shrink-0 flex-wrap',
								compact ? 'gap-1 sm:gap-2' : 'gap-2'
							)}
						>
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
