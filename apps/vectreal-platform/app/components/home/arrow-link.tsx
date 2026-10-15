import { cn } from '@shared/utils'
import { ArrowRight } from 'lucide-react'
import { Link, type LinkProps } from 'react-router'

/** The home page's text link with a trailing arrow; the caller sets its color and spacing. */
export function ArrowLink({ className, children, ...props }: LinkProps) {
	return (
		<Link
			{...props}
			className={cn(
				'text-body-sm inline-flex w-fit items-center gap-1 underline-offset-4 hover:underline',
				className as string
			)}
		>
			{children}
			<ArrowRight className="size-3.5" aria-hidden="true" />
		</Link>
	)
}
