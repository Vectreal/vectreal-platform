import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger
} from '@shared/components/ui/tooltip'
import { Info } from 'lucide-react'
import type { ReactNode } from 'react'

/**
 * Props for InfoTooltip component
 */
interface InfoTooltipProps {
	content: string | ReactNode
}

/**
 * InfoTooltip component for displaying help information
 */
export const InfoTooltip = ({ content }: InfoTooltipProps) => (
	<TooltipProvider>
		<Tooltip>
			<TooltipTrigger asChild>
				<Info className="text-muted-foreground h-4 w-4 cursor-help" />
			</TooltipTrigger>
			<TooltipContent className="max-w-80">{content}</TooltipContent>
		</Tooltip>
	</TooltipProvider>
)
