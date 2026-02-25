import {
	AccordionItemProps,
	AccordionTriggerProps
} from '@radix-ui/react-accordion'
import {
	AccordionItem as BaseAccordionItem,
	AccordionTrigger as BaseAccordionTrigger
} from '@shared/components/ui/accordion'
import { cn } from '@shared/utils'

export const AccordionItem = ({ className, ...props }: AccordionItemProps) => {
	return (
		<BaseAccordionItem
			{...props}
			className={cn(
				'bg-muted/50 rounded-xl border px-4 backdrop-blur-2xl',
				className
			)}
		/>
	)
}

export const AccordionTrigger = ({
	className,
	...props
}: AccordionTriggerProps) => {
	return (
		<BaseAccordionTrigger {...props} className={cn('px-2', className)}>
			<span className="flex items-center gap-3">{props.children}</span>
		</BaseAccordionTrigger>
	)
}
