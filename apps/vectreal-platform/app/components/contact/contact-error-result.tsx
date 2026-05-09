import { Button } from '@shared/components/ui/button'
import { AlertCircle } from 'lucide-react'

interface ContactErrorResultProps {
	error?: string
	onDismiss: () => void
}

export function ContactErrorResult({
	error,
	onDismiss
}: ContactErrorResultProps) {
	return (
		<div className="border-error-border bg-error-bg text-error-foreground space-y-4 rounded-2xl border p-5">
			<div className="flex items-center gap-2 font-medium">
				<AlertCircle className="h-5 w-5" />
				We could not send your message
			</div>
			<p className="text-sm">{error ?? 'Please try again in a moment.'}</p>
			<Button type="button" variant="outline" onClick={onDismiss}>
				Try again
			</Button>
		</div>
	)
}
