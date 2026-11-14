import { Button } from '@shared/components/ui/button'
import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router'

import { HOME_PAGE_COPY } from '../../constants/product-copy'

const COPY = HOME_PAGE_COPY.pilot

/**
 * How the free-model offer works, after the mission statement. The hero has
 * already made the offer, so the band does not make it again: its heading and
 * the way in on one side, the three steps on the other as ruled rows,
 * numbered because they happen in that order. On a phone they stack, the
 * steps under the button.
 */
export const PilotBand = () => (
	<div className="flex flex-col gap-12">
		<div className="grid items-start gap-16 lg:grid-cols-[5fr_6fr] lg:gap-24">
			<div>
				<h2 id="pilot-heading" className="text-headline" data-reveal>
					{COPY.heading}
				</h2>
				<div className="mt-10" data-reveal>
					<Button
						asChild
						size="lg"
						variant="brand"
						className="tap-target relative w-full sm:w-fit"
					>
						<Link to="/free-model">
							{COPY.cta}
							<ArrowRight aria-hidden="true" />
						</Link>
					</Button>
				</div>
			</div>

			<ol aria-label={COPY.stepsLabel} data-reveal>
				{COPY.steps.map((step, i) => (
					<li
						key={step.title}
						className="border-foreground/10 grid grid-cols-[3rem_1fr] gap-4 border-t py-7 last:border-b"
					>
						<span
							aria-hidden="true"
							className="text-eyebrow text-muted-foreground pt-1"
						>
							{String(i + 1).padStart(2, '0')}
						</span>
						<div className="space-y-1.5">
							<h3 className="text-body-lg text-foreground font-medium">
								{step.title}
							</h3>
							<p className="text-muted-foreground text-body">{step.body}</p>
						</div>
					</li>
				))}
			</ol>
		</div>

		<p className="text-muted-foreground text-body-sm" data-reveal>
			{COPY.note}
		</p>
	</div>
)
