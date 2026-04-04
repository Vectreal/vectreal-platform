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
			className={cn('rounded-xl px-4', className)}
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
