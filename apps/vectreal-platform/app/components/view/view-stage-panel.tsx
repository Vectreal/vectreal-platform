import { RegistrationMark } from '@shared/components/assets/icons/registration-mark'
import { cn } from '@shared/utils'
import { Loader2 } from 'lucide-react'

import { DitherGrain } from '../layout-components/dither-grain'

import type { ReactNode } from 'react'

const CORNERS = [
	'top-4 left-4',
	'top-4 right-4',
	'bottom-4 left-4',
	'bottom-4 right-4'
] as const

type Props =
	| { busy: string; heading?: never; children?: never }
	| { busy?: never; heading: string; children?: ReactNode }

/**
 * What the stage shows when it is not showing a model: the invitation, a
 * read in progress, or the next step after a link could not be read.
 *
 * Drawn in the converter's sheet language (`converter-empty-stage.tsx`), so the
 * two pages that open a file in the browser look like the same instrument.
 *
 * Announces nothing itself: the page holds one status region for the whole
 * stage (`view-surface.tsx`), so a swap of panels is read once.
 *
 * Not an error state. A link this page cannot read is a host's choice or an
 * expired file, and the visitor can still open the model by dropping it, so
 * every message here ends in that step rather than in an apology.
 */
export function ViewStagePanel({ busy, heading, children }: Props) {
	return (
		<>
			<DitherGrain origin="right" />
			{CORNERS.map((corner) => (
				<RegistrationMark
					key={corner}
					className={cn('text-foreground/30 absolute size-4', corner)}
				/>
			))}
			<div className="flex min-h-[17rem] flex-col justify-end p-6 sm:min-h-[20rem] sm:p-8">
				{busy ? (
					<p className="text-muted-foreground text-body-sm flex items-center gap-2">
						<Loader2 className="h-4 w-4 animate-spin" aria-hidden />
						{busy}
					</p>
				) : (
					<div>
						<p className="text-h3 text-foreground max-w-lg">{heading}</p>
						{children}
					</div>
				)}
			</div>
		</>
	)
}
