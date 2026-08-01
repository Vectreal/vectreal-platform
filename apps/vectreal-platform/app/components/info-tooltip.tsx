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
 */
export const InfoTooltip = ({ content, className }: InfoTooltipProps) => (
	<TooltipProvider>
		<Tooltip>
			<TooltipTrigger asChild>
				<Info
					className={cn('text-muted-foreground size-4 cursor-help', className)}
				/>
			</TooltipTrigger>
			<TooltipContent className="max-w-80">{content}</TooltipContent>
		</Tooltip>
	</TooltipProvider>
)
