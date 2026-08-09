import { cn } from '@shared/utils'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import * as React from 'react'
import { DayPicker } from 'react-day-picker'

import { buttonVariants } from './button'

import type { ChevronProps } from 'react-day-picker'

/**
 * The class name keys below are react-day-picker v10's. Selection and day-state
 * modifiers (`selected`, `today`, `range_*`, ...) land on the day cell itself,
 * so the inner button is reached with `[&>button]` rather than the
 * `[&:has([aria-selected])]` selectors the pre-v9 keys needed.
 */
function Calendar({
	className,
	classNames,
	showOutsideDays = true,
	...props
}: React.ComponentProps<typeof DayPicker>) {
	const navButton = cn(
		buttonVariants({ variant: 'outline' }),
		'size-7 bg-transparent p-0 opacity-50 hover:opacity-100'
	)

	return (
		<DayPicker
			showOutsideDays={showOutsideDays}
			// `w-fit` keeps the absolutely-positioned nav pinned to the grid's edges
			// rather than to whatever width the calendar happens to sit in.
			className={cn('w-fit p-3', className)}
			classNames={{
				// v10 renders `nav` as a sibling of `month` inside `months`, not
				// inside the caption - so `months` is what the nav buttons anchor to.
				months: 'relative flex flex-col gap-2 sm:flex-row',
				month: 'flex flex-col gap-4',
				month_caption: 'flex h-7 w-full items-center justify-center',
				caption_label: 'text-sm font-medium',
				nav: 'flex items-center gap-1',
				button_previous: cn(navButton, 'absolute top-0 left-0 z-10'),
				button_next: cn(navButton, 'absolute top-0 right-0 z-10'),
				month_grid: 'w-full border-collapse',
				weekdays: 'flex',
				weekday:
					'text-muted-foreground w-8 rounded-md text-[0.8rem] font-normal',
				week: 'mt-2 flex w-full',
				day: 'relative size-8 p-0 text-center text-sm focus-within:relative focus-within:z-20',
				day_button: cn(
					buttonVariants({ variant: 'ghost' }),
					'size-8 p-0 font-normal'
				),
				selected:
					'[&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary [&>button]:hover:text-primary-foreground',
				today: '[&>button]:ds-overlay [&>button]:text-foreground [&>button]:font-medium',
				outside: '[&>button]:text-muted-foreground',
				disabled: '[&>button]:text-muted-foreground [&>button]:opacity-50',
				range_start: 'bg-primary/12 rounded-l-md',
				// A day inside a range carries both `selected` and `range_middle`, and
				// the two `[&>button]` rules have equal specificity - so the winner
				// would otherwise come down to Tailwind's utility ordering. Force it,
				// or the band renders near-white text on a near-white background.
				range_middle:
					'bg-primary/12 [&>button]:bg-transparent! [&>button]:text-foreground! [&>button]:hover:bg-transparent',
				range_end: 'bg-primary/12 rounded-r-md',
				hidden: 'invisible',
				...classNames
			}}
			components={{
				Chevron: ({ className, orientation, ...iconProps }: ChevronProps) => {
					const Icon = orientation === 'left' ? ChevronLeft : ChevronRight
					return <Icon className={cn('size-4', className)} {...iconProps} />
				}
			}}
			{...props}
		/>
	)
}

export { Calendar }
