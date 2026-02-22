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
			<TooltipTrigger asChild>
				<span
					className={cn('inline-flex', {
						'cursor-not-allowed opacity-50': disabled
					})}
				>
					<Button
						variant="secondary"
						className={cn('rounded-xl', className)}
						size={size}
						disabled={disabled}
						{...buttonProps}
					>
						{children}
					</Button>
				</span>
			</TooltipTrigger>
			<TooltipContent>{info}</TooltipContent>
		</Tooltip>
	)
}

export { TooltipButton }
