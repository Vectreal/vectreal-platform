import {
	Tooltip,
	TooltipContent,
	TooltipTrigger
} from '@shared/components/ui/tooltip'
import { ArrowUpRight } from 'lucide-react'

interface SceneInfoTriggerProps {
	onClick: () => void
}

export const SceneInfoTrigger = ({ onClick }: SceneInfoTriggerProps) => {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<button
					type="button"
					onClick={onClick}
					className="publisher-shell-focus publisher-shell-floating text-foreground fixed right-0 bottom-8 z-20 m-3 flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-opacity hover:opacity-90"
				>
					Open publishing panel
					<ArrowUpRight className="h-3.5 w-3.5" />
				</button>
			</TooltipTrigger>
			<TooltipContent>
				<p>View scene information and publish your scene</p>
			</TooltipContent>
		</Tooltip>
	)
}
