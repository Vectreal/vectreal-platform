import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger
} from '@shared/components/ui/tooltip'
import { cn } from '@shared/utils'
import { Info } from 'lucide-react'

import type { ReactNode } from 'react'

/**
 * Props for InfoTooltip component
 */
interface InfoTooltipProps {
	content: string | ReactNode
	/** Icon classes. Sized down when the trigger sits beside small label type. */
	className?: string
}

/**
 * InfoTooltip component for displaying help information
 *
 * The trigger is a real button rather than the icon itself. Radix's
 * TooltipTrigger is a `Primitive.button` that adds no tabIndex of its own, so
 * under `asChild` it merges onto whatever it is given: an `<svg>` has no
 * default tab stop, and the tooltip could not be opened by keyboard at all.
 */
export const InfoTooltip = ({ content, className }: InfoTooltipProps) => (
	<TooltipProvider>
		<Tooltip>
			<TooltipTrigger asChild>
				<button
					type="button"
					aria-label="More information"
					className="focus-visible:ring-ring focus-visible:ring-offset-background inline-flex shrink-0 cursor-help items-center justify-center rounded-full focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
				>
					<Info
						aria-hidden
						className={cn('text-muted-foreground size-4', className)}
					/>
				</button>
			</TooltipTrigger>
			<TooltipContent className="max-w-80">{content}</TooltipContent>
		</Tooltip>
	</TooltipProvider>
)
