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

export function ConsentPreferencesDialog() {
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
			<DialogContent className="max-w-lg">
				<DialogHeader>
					<DialogTitle>Cookie preferences</DialogTitle>
					<DialogDescription>
						Manage which cookies and tracking technologies we use. Strictly
						necessary cookies cannot be disabled as they are required for the
						platform to work.
					</DialogDescription>
				</DialogHeader>

				<div className="divide-y">
					<CategoryRow
						label="Strictly necessary"
						description="Essential for authentication, security (CSRF), and platform operation. Always active."
						checked={true}
						disabled
						onCheckedChange={() => {}}
					/>
					<Separator />
					<CategoryRow
						label="Functional"
						description="Remember your preferences such as theme and sidebar state across sessions."
						checked={functional}
						onCheckedChange={setFunctional}
					/>
					<Separator />
					<CategoryRow
						label="Analytics & performance"
						description="Help us understand how you use Vectreal via aggregated, anonymised usage data (PostHog). No PII is shared."
						checked={analytics}
						onCheckedChange={setAnalytics}
					/>
					<Separator />
					<CategoryRow
						label="Marketing & personalisation"
						description="Allow us to personalise marketing communications and product-led growth experiments."
						checked={marketing}
						onCheckedChange={setMarketing}
					/>
				</div>

				<DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
					<Button variant="secondary" onClick={handleSave}>
						Save preferences
					</Button>
					<Button onClick={handleAcceptAll}>Accept all</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
