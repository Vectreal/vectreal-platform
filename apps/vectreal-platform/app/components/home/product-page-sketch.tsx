import { cn, formatFileSize } from '@shared/utils'

import { HOME_PAGE_COPY } from '../../constants/product-copy'
import { HERO_MODEL } from '../../lib/samples/sample-models'

import type { ReactNode } from 'react'

const ADDRESS = HOME_PAGE_COPY.product.views.embed.pageAddress

/*
  The page's words. Kept here rather than in the product copy because none of
  them is a claim about Vectreal: they are props on a drawing of somebody else's
  page, chosen to name no one and sell nothing. The one line that is about
  Vectreal, the model file and its size, is read from the file the page serves.
*/
const SHOP = {
	marker: 'Embed demo',
	store: 'Your store',
	nav: ['New', 'Cameras', 'Lenses'],
	bag: 'Bag (0)',
	crumbs: 'Cameras / Rangefinder',
	product: 'Field Camera',
	price: '€ 000',
	finish: 'Finish',
	addToBag: 'Add to bag',
	note: 'A drawing of where an embed lives. Nothing here is for sale.',
	specs: [
		['Model', `${HERO_MODEL.fileName}, ${formatFileSize(HERO_MODEL.bytes)}`]
	]
} as const

/** A line of text on the page, as a skeleton: the page is anyone's, so it says nothing of its own. */
export const SketchLine = ({ className }: { className: string }) => (
	<span
		aria-hidden="true"
		className={cn('bg-foreground/10 block rounded-full', className)}
	/>
)

/** The finishes a shop would offer, as tones of the ink rather than colors that would read as a real product line. */
const SWATCHES = ['bg-foreground/85', 'bg-foreground/40', 'bg-foreground/15']

/**
 * A shop's product page with the camera in its gallery: where a Vectreal embed
 * ends up.
 *
 * Detailed enough to read as a product page at a glance - a store bar, a
 * breadcrumb, a title, a price, finishes, a bag button, a thumbnail strip - and
 * kept from passing for a real store on purpose, because someone new to this
 * will otherwise try to buy the camera. The store is "Your store", the price is
 * "€ 000", the description stays skeleton lines (where invented marketing copy
 * would creep in), an "Embed demo" marker sits in the address bar, and one plain
 * line says nothing is for sale. The bag button is a drawing of a button: not
 * focusable, no hover. At 16:10, the shape of the product window's screenshots,
 * so it can stand in a view beside them.
 *
 * `compact` keeps the skeleton version, tighter, for a small drawing of the same
 * page where words would be too small to read.
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
			compact ? 'gap-2 p-2' : 'gap-3 p-3 sm:gap-4 sm:p-5',
			className
		)}
	>
		<div className="flex items-center gap-2">
			<span className="ds-field text-muted-foreground text-label-xs w-fit rounded-full px-3 py-1">
				{ADDRESS}
			</span>
			{!compact && (
				<span className="text-eyebrow text-orange-ink ml-auto">
					{SHOP.marker}
				</span>
			)}
		</div>

		{!compact && (
			<div
				aria-hidden="true"
				className="text-muted-foreground text-label-xs hidden items-center gap-5 sm:flex"
			>
				<span className="text-foreground text-eyebrow">{SHOP.store}</span>
				{SHOP.nav.map((item) => (
					<span key={item} className="hidden md:inline">
						{item}
					</span>
				))}
				<span className="ml-auto">{SHOP.bag}</span>
			</div>
		)}

		{/* One bounded row: an auto row grows to the product column's full height and pushes the gallery's foot out of the 16:10 frame. */}
		<div
			className={cn(
				'grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)]',
				compact ? 'grid-cols-[3fr_2fr] gap-3' : 'gap-6 sm:grid-cols-[3fr_2fr]'
			)}
		>
			<div className="flex min-h-0 flex-col gap-2">
				<div className="ds-sunken relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-lg">
					{gallery}
				</div>
				{!compact && (
					<div aria-hidden="true" className="hidden gap-2 sm:flex">
						<span className="ds-sunken ring-foreground/60 size-8 rounded-md ring-1" />
						<span className="ds-sunken size-8 rounded-md" />
						<span className="ds-sunken size-8 rounded-md" />
						<span className="ds-sunken size-8 rounded-md" />
					</div>
				)}
			</div>

			{compact ? (
				<div className="flex flex-col justify-center gap-2">
					<SketchLine className="h-2 w-16 max-w-full" />
					<SketchLine className="bg-foreground/20 h-4 w-3/4" />
					<SketchLine className="h-3 w-1/4" />
					<div className="mt-2 flex flex-col gap-2">
						<SketchLine className="h-2 w-full" />
						<SketchLine className="h-2 w-11/12" />
						<SketchLine className="h-2 w-2/3" />
					</div>
					<SketchLine className="bg-foreground/80 mt-3 h-4 w-full" />
				</div>
			) : (
				// Safe centering: if the column runs taller than its row, it starts at the top instead of clipping both ends.
				<div className="hidden min-h-0 flex-col justify-center-safe gap-3 overflow-hidden pr-2 sm:flex">
					<div aria-hidden="true" className="flex flex-col gap-3">
						<span className="text-muted-foreground text-label-xs">
							{SHOP.crumbs}
						</span>
						<span className="text-h4">{SHOP.product}</span>
						<span className="text-body-sm tabular-nums">{SHOP.price}</span>
						<div className="flex flex-col gap-2">
							<SketchLine className="h-2 w-full" />
							<SketchLine className="h-2 w-11/12" />
							<SketchLine className="hidden h-2 w-2/3 lg:block" />
						</div>
						<div className="text-muted-foreground text-label-xs flex items-center gap-2">
							{SWATCHES.map((tone, index) => (
								<span
									key={tone}
									className={cn(
										'size-4 rounded-full',
										tone,
										index === 0 &&
											'ring-foreground ring-offset-background ring-1 ring-offset-2'
									)}
								/>
							))}
							<span className="ml-1">{SHOP.finish}</span>
						</div>
						<span className="bg-foreground text-background text-label-xs flex h-8 items-center justify-center rounded-lg">
							{SHOP.addToBag}
						</span>
					</div>
					<p className="text-muted-foreground text-label-xs">{SHOP.note}</p>
					<dl className="text-label-xs hidden grid-cols-[auto_1fr] gap-x-3 gap-y-1 lg:grid">
						{SHOP.specs.map(([term, value]) => (
							<div key={term} className="contents">
								<dt className="text-muted-foreground">{term}</dt>
								<dd>{value}</dd>
							</div>
						))}
					</dl>
				</div>
			)}
		</div>
	</div>
)
