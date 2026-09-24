import { cn } from '@shared/utils'

import { HOME_PAGE_COPY } from '../../constants/product-copy'

import type { ReactNode } from 'react'

const ADDRESS = HOME_PAGE_COPY.product.views.embed.pageAddress

/** A line of text on the page, as a skeleton: the page is anyone's, so it says nothing of its own. */
export const SketchLine = ({ className }: { className: string }) => (
	<span
		aria-hidden="true"
		className={cn('bg-foreground/10 block rounded-full', className)}
	/>
)

/**
 * A shop's product page with the camera in its gallery: where a Vectreal embed
 * ends up.
 *
 * Left blank but for the object. Inventing a shop would put words on it that no
 * customer wrote, so the details are skeleton lines and the only text is an
 * address that names no one. At 16:10, the shape of the product window's
 * screenshots, so it can stand in a view beside them.
 *
 * `compact` drops the details column on every screen and tightens the spacing,
 * for a small drawing of the same page.
 */
export const ProductPageSketch = ({
	gallery,
	compact = false,
	className
}: {
	gallery: ReactNode
	compact?: boolean
	className?: string
}) => (
	<div
		className={cn(
			'bg-background flex aspect-16/10 flex-col',
			compact ? 'gap-2 p-2' : 'gap-3 p-3 sm:gap-5 sm:p-5',
			className
		)}
	>
		<span className="ds-field text-muted-foreground text-label-xs w-fit rounded-full px-3 py-1">
			{ADDRESS}
		</span>

		<div
			className={cn(
				'grid min-h-0 flex-1',
				compact ? 'grid-cols-[3fr_2fr] gap-3' : 'gap-6 sm:grid-cols-[3fr_2fr]'
			)}
		>
			<div className="ds-sunken relative flex min-h-0 items-center justify-center overflow-hidden rounded-lg">
				{gallery}
			</div>

			<div
				className={cn(
					'flex-col justify-center',
					compact ? 'flex gap-2' : 'hidden gap-3 pr-2 sm:flex'
				)}
			>
				<SketchLine className="h-2 w-16 max-w-full" />
				<SketchLine className="bg-foreground/20 h-4 w-3/4" />
				<SketchLine className="h-3 w-1/4" />
				<div className="mt-2 flex flex-col gap-2">
					<SketchLine className="h-2 w-full" />
					<SketchLine className="h-2 w-11/12" />
					<SketchLine className="h-2 w-2/3" />
				</div>
				<SketchLine
					className={cn(
						'bg-foreground/80 mt-3 w-full',
						compact ? 'h-4' : 'h-8'
					)}
				/>
			</div>
		</div>
	</div>
)
