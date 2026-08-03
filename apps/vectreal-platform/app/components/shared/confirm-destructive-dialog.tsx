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
import { AlertTriangle, Loader2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import type { DashboardConfirmationPlan } from '../../lib/domain/dashboard/dashboard-confirmation'

interface ConfirmDestructiveDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	/** What is being destroyed and how much friction it deserves. */
	plan: DashboardConfirmationPlan
	isPending?: boolean
	/** Disables confirm and explains why - a permission the user lacks. */
	blockedReason?: string | null
	/** A failed attempt, shown in place rather than as a toast that outlives the dialog. */
	errorMessage?: string | null
	cancelLabel?: string
	onConfirm: (confirmationText: string | null) => void
}

/**
 * The one destructive confirmation in the dashboard.
 *
 * Replaces a typed-confirmation modal used for two things, three separate
 * `AlertDialog`s that each styled their confirm button differently (one of them
 * not destructively at all), and three organization actions that had no
 * confirmation whatsoever.
 *
 * Built on `Dialog` rather than `AlertDialog` because the typed tier needs a
 * focusable text input, which `AlertDialog`'s focus trap fights. One primitive
 * serves both tiers, so this is one component rather than a branch across two.
 *
 * It does not close itself on confirm. The caller closes it when the mutation
 * resolves, so a server rejection stays on screen next to the input that caused
 * it instead of vanishing behind a toast.
 */
export function ConfirmDestructiveDialog({
	open,
	onOpenChange,
	plan,
	isPending = false,
	blockedReason = null,
	errorMessage = null,
	cancelLabel = 'Cancel',
	onConfirm
}: ConfirmDestructiveDialogProps) {
	const [typedText, setTypedText] = useState('')

	// Reset on close, and also whenever the token changes - reusing one mounted
	// dialog for a second target must not inherit the first one's typing.
	useEffect(() => {
		setTypedText('')
	}, [open, plan.token])

	const isTokenSatisfied = useMemo(() => {
		if (plan.token === null) {
			return true
		}
		return typedText.trim() === plan.token
	}, [plan.token, typedText])

	const canConfirm = isTokenSatisfied && !isPending && !blockedReason

	const handleConfirm = () => {
		if (!canConfirm) {
			return
		}
		onConfirm(plan.token)
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			{/*
			  `gap-5` and a left-aligned header rather than the defaults. The shared
			  content applies one uniform gap to every child, which made the title,
			  the summary, the consequences, the confirm field and the footer read as
			  five slabs of equal weight. Here they are two groups - what is being
			  destroyed, and what you have to do about it - so the spacing says so.
			*/}
			<DialogContent className="gap-5">
				<DialogHeader className="gap-1.5 text-left">
					<DialogTitle className="pr-6">{plan.title}</DialogTitle>
					<DialogDescription>{plan.description}</DialogDescription>
				</DialogHeader>

				{plan.consequences.length > 0 ? (
					// A quiet block rather than loose bullets: at the same size and
					// color as the description above, the itemization read as more of
					// the same sentence instead of a list of outcomes.
					<ul className="ds-sunken text-muted-foreground space-y-2 rounded-xl p-4 text-sm">
						{plan.consequences.map((consequence) => (
							<li key={consequence} className="flex gap-2.5">
								<span aria-hidden="true" className="text-muted-foreground/60">
									&bull;
								</span>
								<span className="leading-snug">{consequence}</span>
							</li>
						))}
					</ul>
				) : null}

				{plan.token !== null ? (
					<div className="space-y-2">
						<label
							htmlFor="destructive-confirmation"
							className="text-muted-foreground block text-sm"
						>
							Type{' '}
							<span className="text-foreground font-mono font-semibold">
								{plan.token}
							</span>{' '}
							to confirm.
						</label>
						{/*
						  A tighter radius than the global `--radius: 1rem`. At full
						  width that default made the confirm field the heaviest shape
						  on screen, which is not where the eye should land.
						*/}
						<Input
							id="destructive-confirmation"
							value={typedText}
							onChange={(event) => setTypedText(event.target.value)}
							disabled={isPending || Boolean(blockedReason)}
							autoComplete="off"
							autoCorrect="off"
							autoCapitalize="off"
							spellCheck={false}
							className="rounded-lg font-mono"
						/>
					</div>
				) : null}

				{blockedReason ? (
					<p className="text-muted-foreground flex items-start gap-2 text-sm">
						<AlertTriangle className="mt-0.5 size-4 shrink-0" />
						<span>{blockedReason}</span>
					</p>
				) : null}

				{errorMessage ? (
					<p
						role="alert"
						className="text-destructive flex items-start gap-2 text-sm"
					>
						<AlertTriangle className="mt-0.5 size-4 shrink-0" />
						<span>{errorMessage}</span>
					</p>
				) : null}

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
						disabled={!canConfirm}
					>
						{isPending ? (
							<>
								<Loader2 className="animate-spin" />
								Working...
							</>
						) : (
							plan.confirmLabel
						)}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
