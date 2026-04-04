import { Button } from '@shared/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle
} from '@shared/components/ui/dialog'
import { Input } from '@shared/components/ui/input'
import { useEffect, useMemo, useState } from 'react'

interface WrittenConfirmationModalProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	title: string
	description: string
	confirmationText: string
	confirmLabel?: string
	cancelLabel?: string
	isPending?: boolean
	onConfirm: (typedText: string) => void
}

export function WrittenConfirmationModal({
	open,
	onOpenChange,
	title,
	description,
	confirmationText,
	confirmLabel = 'Confirm',
	cancelLabel = 'Cancel',
	isPending = false,
	onConfirm
}: WrittenConfirmationModalProps) {
	const [typedText, setTypedText] = useState('')

	useEffect(() => {
		if (!open) {
			setTypedText('')
		}
	}, [open])

	const isConfirmationMatch = useMemo(
		() => typedText.trim() === confirmationText,
		[typedText, confirmationText]
	)

	const handleConfirm = () => {
		if (!isConfirmationMatch || isPending) {
			return
		}

		onConfirm(typedText.trim())
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>{description}</DialogDescription>
				</DialogHeader>

				<div className="space-y-3">
					<p className="text-muted-foreground text-sm">
						Type{' '}
						<span className="font-mono font-semibold">{confirmationText}</span>{' '}
						to confirm.
					</p>
					<Input
						value={typedText}
						onChange={(event) => setTypedText(event.target.value)}
						placeholder={confirmationText}
						autoComplete="off"
						autoCorrect="off"
						autoCapitalize="off"
						spellCheck={false}
					/>
				</div>

				<DialogFooter>
					<Button
						type="button"
						variant="outline"
						onClick={() => onOpenChange(false)}
						disabled={isPending}
					>
						{cancelLabel}
					</Button>
					<Button
						type="button"
						variant="destructive"
						onClick={handleConfirm}
						disabled={!isConfirmationMatch || isPending}
					>
						{confirmLabel}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
