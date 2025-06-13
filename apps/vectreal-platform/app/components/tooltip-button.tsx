import { Button } from '@vctrl-ui/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@vctrl-ui/ui/tooltip'
import { PropsWithChildren } from 'react'

interface ButtonProps extends PropsWithChildren {
	onClick?: () => void
	info: string
	size?: 'icon' | 'sm'
}

const TooltipButton = ({ children, info, size, onClick }: ButtonProps) => {
	return (
		<Tooltip>
			<TooltipTrigger>
				<Button
					asChild
					variant="secondary"
					className="rounded-xl"
					onClick={onClick}
					size={size}
				>
					<span>{children}</span>
				</Button>
				<TooltipContent>{info}</TooltipContent>
			</TooltipTrigger>
		</Tooltip>
	)
}

export { TooltipButton }
