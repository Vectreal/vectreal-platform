import { Button } from '@shared/components/ui/button'
import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router'

import { CameraDrawing, CameraObject } from './camera-drawing'
import { ProductPageSketch, SketchLine } from './product-page-sketch'
import {
	HOME_PAGE_COPY,
	PILOT_CONTACT_HREF
} from '../../constants/product-copy'

import type { ReactNode } from 'react'

const COPY = HOME_PAGE_COPY.pilot

/*
  One drawing per term, in the order a pilot runs: the files you bring, the
  viewer we build into your site, and the case study we publish together. Each
  is the hero's camera again, standing in for your product, so the three read
  as one project rather than three icons.
*/
const DRAWINGS: ReactNode[] = [
	<div
		key="files"
		className="text-muted-foreground flex h-full items-center justify-center"
	>
		<CameraDrawing className="w-3/5" />
	</div>,
	<ProductPageSketch
		key="site"
		compact
		// The frame around it sets the shape; its own 16:10 would fight the frame's padding.
		className="aspect-auto h-full"
		gallery={<CameraObject className="w-4/5" />}
	/>,
	<div
		key="case-study"
		className="bg-background flex h-full flex-col gap-2 p-2"
	>
		<div className="ds-sunken flex min-h-0 flex-1 items-center justify-center rounded-lg">
			<CameraObject className="w-1/2" />
		</div>
		<span className="text-eyebrow text-muted-foreground pt-1">
			{COPY.caseStudyLabel}
		</span>
		<SketchLine className="bg-foreground/20 h-3 w-4/5" />
		<SketchLine className="h-2 w-3/5" />
	</div>
]

/**
 * The founding-client offer, written as terms rather than as features.
 *
 * Each term opens on a small drawing of the stage of the project it belongs
 * to, so the offer can be read at a glance before it is read in full. The
 * columns are equal, so the drawings share one size and the terms start on one
 * line under them.
 */
export const PilotOffer = () => (
	<div className="flex flex-col gap-16">
		<div className="max-w-2xl">
			<h2 id="pilot-heading" className="text-headline" data-reveal>
				{COPY.heading}
			</h2>
			<p className="text-muted-foreground text-body-lg mt-8" data-reveal>
				{COPY.lead}
			</p>
		</div>

		<div className="grid gap-12 lg:grid-cols-3 lg:gap-8" data-reveal>
			{COPY.blocks.map((block, i) => (
				<div key={block.title} className="flex flex-col gap-4">
					<div
						aria-hidden="true"
						className="ds-raised aspect-16/10 overflow-hidden rounded-xl p-1.5"
					>
						<div className="h-full overflow-hidden rounded-lg">
							{DRAWINGS[i]}
						</div>
					</div>
					<h3 className="text-h4 pt-4">{block.title}</h3>
					<p className="text-muted-foreground text-body">{block.body}</p>
				</div>
			))}
		</div>

		<div
			className="flex flex-col gap-8 sm:flex-row sm:items-center sm:justify-between"
			data-reveal
		>
			<p className="text-foreground text-body max-w-md">{COPY.team}</p>
			<Button asChild size="lg" className="w-full sm:w-fit">
				<Link to={PILOT_CONTACT_HREF}>
					{COPY.cta}
					<ArrowRight aria-hidden="true" />
				</Link>
			</Button>
		</div>
	</div>
)
