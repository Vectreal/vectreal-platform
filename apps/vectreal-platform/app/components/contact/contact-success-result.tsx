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
	/*
	  Fill only. InlineNotice does this same job without a border, and its
	  docstring records that the border was removed for exactly this reason: a
	  tinted panel already reads as a panel, and outlining it as well states the
	  boundary twice.
	*/
	return (
		<div className="bg-success/25 text-success-foreground/80 space-y-4 rounded-2xl p-5">
			<div className="flex items-center gap-2 font-medium">
				<CheckCircle2 className="h-5 w-5" />
				Your message has been sent
			</div>
			<p className="text-success-foreground/70 text-body-sm">
				Thanks for reaching out. Our team will get back to you within one
				business day.
			</p>
			{referenceCode ? (
				<p className="text-success-foreground/70 text-body-sm">
					Reference code: <span className="font-semibold">{referenceCode}</span>
				</p>
			) : null}
			{notice ? (
				<p className="text-warning-muted-foreground text-body-sm">{notice}</p>
			) : null}
			<Button type="button" variant="outline" onClick={onDismiss}>
				Send another message
			</Button>
		</div>
	)
}
