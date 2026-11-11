import { Button } from '@shared/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle
} from '@shared/components/ui/dialog'
import { Separator } from '@shared/components/ui/separator'
import { Toggle } from '@shared/components/ui/toggle'
import { useState } from 'react'

import { useConsent } from './consent-context'

import type { ModelIntakeLocale } from '../../lib/domain/model-intake/model-intake-shared'

/* German on the German letter pages, like the banner that opens it. */
const DIALOG_COPY = {
	en: {
		title: 'Cookie preferences',
		description:
			'Manage which cookies and tracking technologies we use. Strictly necessary cookies cannot be disabled as they are required for the platform to work.',
		necessary: 'Strictly necessary',
		necessaryDescription:
			'Essential for authentication, security (CSRF), and platform operation. Always active.',
		functional: 'Functional',
		functionalDescription:
			'Remember your preferences such as theme and sidebar state across sessions.',
		analytics: 'Analytics & performance',
		analyticsDescription:
			'Help us understand how you use Vectreal via aggregated, anonymised usage data (PostHog). No PII is shared.',
		marketing: 'Marketing & personalisation',
		marketingDescription:
			'Allow us to personalise marketing communications and product-led growth experiments.',
		save: 'Save preferences',
		acceptAll: 'Accept all'
	},
	de: {
		title: 'Cookie-Einstellungen',
		description:
			'Hier legen Sie fest, welche Cookies und Tracking-Technologien ich verwende. Notwendige Cookies lassen sich nicht abschalten, weil die Seite ohne sie nicht funktioniert.',
		necessary: 'Notwendig',
		necessaryDescription:
			'Für Anmeldung, Sicherheit (CSRF) und den Betrieb der Seite. Immer aktiv.',
		functional: 'Funktional',
		functionalDescription:
			'Merkt sich Ihre Einstellungen, etwa das Farbschema, über Besuche hinweg.',
		analytics: 'Statistik und Leistung',
		analyticsDescription:
			'Zeigt mir über zusammengefasste, anonymisierte Nutzungsdaten (PostHog), wie Vectreal genutzt wird. Keine personenbezogenen Daten.',
		marketing: 'Marketing und Personalisierung',
		marketingDescription:
			'Erlaubt mir, Marketing-Nachrichten und Produkttests auf Sie zuzuschneiden.',
		save: 'Einstellungen speichern',
		acceptAll: 'Alle akzeptieren'
	}
} as const satisfies Record<ModelIntakeLocale, Record<string, string>>

interface CategoryRowProps {
	label: string
	description: string
	checked: boolean
	disabled?: boolean
	onCheckedChange: (checked: boolean) => void
}

function CategoryRow({
	label,
	description,
	checked,
	disabled = false,
	onCheckedChange
}: CategoryRowProps) {
	return (
		<Toggle
			className="py-3"
			label={label}
			description={description}
			checked={checked}
			onCheckedChange={onCheckedChange}
			disabled={disabled}
		/>
	)
}

export function ConsentPreferencesDialog({
	locale = 'en'
}: {
	locale?: ModelIntakeLocale
}) {
	const copy = DIALOG_COPY[locale]
	const { consent, saveConsent, preferencesOpen, setPreferencesOpen } =
		useConsent()

	const [functional, setFunctional] = useState(consent?.functional ?? false)
	const [analytics, setAnalytics] = useState(consent?.analytics ?? false)
	const [marketing, setMarketing] = useState(consent?.marketing ?? false)

	function handleSave() {
		saveConsent({ functional, analytics, marketing })
		setPreferencesOpen(false)
	}

	function handleAcceptAll() {
		setFunctional(true)
		setAnalytics(true)
		setMarketing(true)
		saveConsent({ functional: true, analytics: true, marketing: true })
		setPreferencesOpen(false)
	}

	return (
		<Dialog open={preferencesOpen} onOpenChange={setPreferencesOpen}>
			<DialogContent className="max-w-lg" lang={locale}>
				<DialogHeader>
					<DialogTitle>{copy.title}</DialogTitle>
					<DialogDescription>{copy.description}</DialogDescription>
				</DialogHeader>

				<div className="divide-y">
					<CategoryRow
						label={copy.necessary}
						description={copy.necessaryDescription}
						checked={true}
						disabled
						onCheckedChange={() => {}}
					/>
					<Separator />
					<CategoryRow
						label={copy.functional}
						description={copy.functionalDescription}
						checked={functional}
						onCheckedChange={setFunctional}
					/>
					<Separator />
					<CategoryRow
						label={copy.analytics}
						description={copy.analyticsDescription}
						checked={analytics}
						onCheckedChange={setAnalytics}
					/>
					<Separator />
					<CategoryRow
						label={copy.marketing}
						description={copy.marketingDescription}
						checked={marketing}
						onCheckedChange={setMarketing}
					/>
				</div>

				<DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
					<Button variant="secondary" onClick={handleSave}>
						{copy.save}
					</Button>
					<Button onClick={handleAcceptAll}>{copy.acceptAll}</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
