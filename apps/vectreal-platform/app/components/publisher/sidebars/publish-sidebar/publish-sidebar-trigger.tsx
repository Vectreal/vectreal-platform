import { Button } from '@shared/components/ui/button'
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger
} from '@shared/components/ui/tooltip'
import { ArrowUpRight } from 'lucide-react'

interface PublishSidebarTriggerProps {
	onClick: () => void
	disabled?: boolean
}

export const PublishSidebarTrigger = ({
	onClick,
	disabled = false
}: PublishSidebarTriggerProps) => {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Button
					variant="secondary"
					disabled={disabled}
					onClick={onClick}
					className="fixed right-0 bottom-6 z-20 m-4"
				>
					Open publishing panel{' '}
					<ArrowUpRight className="inline-block h-3 w-3" />
				</Button>
			</TooltipTrigger>
			<TooltipContent>
				<p>View scene information and publish your scene</p>
			</TooltipContent>
		</Tooltip>
	)
}
