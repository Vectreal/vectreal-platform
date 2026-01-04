import { cn } from '@shared/utils'
import { PropsWithChildren } from 'react'

import FadeInView from './fade-in-view'

interface SectionProps extends PropsWithChildren {
	className?: string
	border?: boolean
	fadeIn?: boolean
}

const Section = ({
	children,
	className,
	border,
	fadeIn = true
}: SectionProps) => {
	return (
		<section
			className={cn(
				'bg-background relative my-32 flex w-full items-center first:mt-0 last:mb-0',
				border && 'mb-0',
				className
			)}
		>
			<FadeInView
				enabled={fadeIn}
				className={cn(
					'flex h-full w-full flex-col items-center justify-center gap-4',
					border && 'border-b-muted/50 border-b pb-16'
				)}
			>
				<div className="mx-auto flex max-w-7xl flex-col px-4">{children}</div>
			</FadeInView>
		</section>
	)
}

export default Section
