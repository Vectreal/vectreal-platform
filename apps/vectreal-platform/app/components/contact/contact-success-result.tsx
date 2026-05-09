import { Button } from '@shared/components/ui/button'
import { CheckCircle2 } from 'lucide-react'

interface ContactSuccessResultProps {
	referenceCode?: string
	notice?: string
	onDismiss: () => void
}

export function ContactSuccessResult({
	referenceCode,
	notice,
	onDismiss
}: ContactSuccessResultProps) {
	return (
		<div className="border-success/50 bg-success/25 text-success-foreground/80 space-y-4 rounded-2xl border p-5">
			<div className="flex items-center gap-2 font-medium">
				<CheckCircle2 className="h-5 w-5" />
				Your message has been sent
			</div>
			<p className="text-success-foreground/70 text-sm">
				Thanks for reaching out. Our team will get back to you within one
				business day.
			</p>
			{referenceCode ? (
				<p className="text-success-foreground/70 text-sm">
					Reference code: <span className="font-semibold">{referenceCode}</span>
				</p>
			) : null}
			{notice ? (
				<p className="text-warning-muted-foreground text-sm">{notice}</p>
			) : null}
			<Button type="button" variant="outline" onClick={onDismiss}>
				Send another message
			</Button>
		</div>
	)
}
