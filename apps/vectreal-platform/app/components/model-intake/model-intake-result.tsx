import { Button } from '@shared/components/ui/button'
import { CheckCircle2 } from 'lucide-react'

import { MODEL_INTAKE_COPY } from '../../constants/product-copy'

import type { ModelIntakeLocale } from '../../lib/domain/model-intake/model-intake-shared'

interface ModelIntakeResultProps {
	locale: ModelIntakeLocale
	referenceCode?: string
	confirmationFailed?: boolean
	onAgain: () => void
}

/** The contact page's success panel, in the intake's words. */
export function ModelIntakeResult({
	locale,
	referenceCode,
	confirmationFailed,
	onAgain
}: ModelIntakeResultProps) {
	const copy = MODEL_INTAKE_COPY[locale].success

	return (
		<div
			role="status"
			className="bg-success/25 text-success-foreground/80 space-y-4 rounded-2xl p-5"
		>
			<div className="flex items-center gap-2 font-medium">
				<CheckCircle2 aria-hidden="true" className="h-5 w-5" />
				{copy.heading}
			</div>
			{referenceCode ? (
				<p className="text-success-foreground/70 text-body-sm">
					{copy.body(referenceCode)}
				</p>
			) : null}
			{confirmationFailed ? (
				<p className="text-warning-muted-foreground text-body-sm">
					{copy.confirmationFailed}
				</p>
			) : null}
			<Button type="button" variant="outline" onClick={onAgain}>
				{copy.again}
			</Button>
		</div>
	)
}
