import {
	AccordionItemProps,
	AccordionTriggerProps
} from '@radix-ui/react-accordion'
import {
	AccordionItem as BaseAccordionItem,
	AccordionTrigger as BaseAccordionTrigger
} from '@shared/components/ui/accordion'
import { CollapsibleTrigger } from '@shared/components/ui/collapsible'
import { cn } from '@shared/utils'
import { ChevronDown } from 'lucide-react'

import type { ReactNode } from 'react'

export const AccordionItem = ({ className, ...props }: AccordionItemProps) => {
	return (
		<BaseAccordionItem
			{...props}
			className={cn('publisher-shell-nested rounded-2xl px-4', className)}
		/>
	)
}

export const AccordionTrigger = ({
	className,
	...props
}: AccordionTriggerProps) => {
	return (
		<BaseAccordionTrigger
			{...props}
			className={cn('py-3 hover:no-underline', className)}
		>
			{/*
			  The section icon is sized here rather than per call site, which had
			  drifted across four values — some of them numeric `size` props that
			  bypass the class entirely and so could not be corrected in one place.
			*/}
			<span className="flex items-center gap-3 [&_svg]:size-4 [&_svg]:shrink-0">
				{props.children}
			</span>
		</BaseAccordionTrigger>
	)
}

interface CollapsibleSectionTriggerProps {
	children: ReactNode
	isOpen: boolean
	className?: string
}

/**
 * Consistent collapsible section trigger used in compose panels.
 * Uses a plain <button> (not the Button component) to avoid h-8/rounded-xl
 * box artefacts from Button size="sm" inside publisher shell surfaces.
 */
export const CollapsibleSectionTrigger = ({
	children,
	isOpen,
	className
}: CollapsibleSectionTriggerProps) => (
	<CollapsibleTrigger asChild>
		<button
			type="button"
			className={cn(
				'publisher-shell-focus border-shell-border-soft text-muted-foreground hover:text-foreground flex w-full items-center justify-between border-t pt-2 text-xs transition-colors',
				className
			)}
		>
			{children}
			<ChevronDown
				className={cn(
					'h-3.5 w-3.5 transition-transform',
					isOpen && 'rotate-180'
				)}
			/>
		</button>
	</CollapsibleTrigger>
)
