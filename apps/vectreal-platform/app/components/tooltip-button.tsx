import { Button } from '@shared/components/ui/button'
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger
} from '@shared/components/ui/tooltip'
import { cn } from '@shared/utils'
import { ComponentProps } from 'react'

interface ButtonProps extends ComponentProps<'button'> {
	info: string
	size?: 'icon' | 'sm'
}

const TooltipButton = ({
	children,
	info,
	size,
	className,
	disabled,
	...buttonProps
}: ButtonProps) => {
	return (
		<Tooltip>
			<TooltipTrigger
				disabled={disabled}
				className={cn({ 'opacity-50': disabled })}
			>
				<Button
					asChild
					variant="secondary"
					className={cn('rounded-xl', className)}
					size={size}
					disabled={disabled}
					{...buttonProps}
				>
					<span>{children}</span>
				</Button>
				<TooltipContent>{info}</TooltipContent>
			</TooltipTrigger>
		</Tooltip>
	)
}

export { TooltipButton }
