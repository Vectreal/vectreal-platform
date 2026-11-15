import { Button } from '@shared/components/ui/button'
import { cn } from '@shared/utils'
import { ArrowRight } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'

import { HomeSceneTour, useHomeTour } from './home-scene-tour'
import { HOME_PAGE_COPY } from '../../constants/product-copy'

const COPY = HOME_PAGE_COPY.pilot

/**
 * How the free-model offer works, after the mission statement. The hero has
 * already made the offer, so the band does not make it again: its heading and
 * the way in on one side, the three steps on the other as ruled rows,
 * numbered because they happen in that order. On a phone they stack, the
 * steps under the button.
 *
 * Where a tour scene is configured, on a wide screen, the steps move under the
 * button and the other side tours the scene by scrolling, one camera a step:
 * the step the scroll has reached is the one in full ink. The prerendered page,
 * a phone, reduced motion and a scene that will not load all keep the band
 * as above.
 */
export const PilotBand = () => {
	const scene = useHomeTour()
	const [unavailable, setUnavailable] = useState(false)
	const [station, setStation] = useState(0)
	const touring = scene !== null && !unavailable

	const steps = (
		<ol aria-label={COPY.stepsLabel} data-reveal>
			{COPY.steps.map((step, i) => (
				<li
					key={step.title}
					aria-current={touring && i === station ? 'step' : undefined}
					className={cn(
						'border-foreground/10 grid grid-cols-[3rem_1fr] gap-4 border-t py-7 last:border-b',
						touring &&
							'text-muted-foreground aria-[current=step]:text-foreground transition-colors duration-(--duration-base)'
					)}
				>
					<span
						aria-hidden="true"
						className="text-eyebrow text-muted-foreground pt-1"
					>
						{String(i + 1).padStart(2, '0')}
					</span>
					<div className="space-y-1.5">
						<h3
							className={cn(
								'text-body-lg font-medium',
								!touring && 'text-foreground'
							)}
						>
							{step.title}
						</h3>
						<p className="text-muted-foreground text-body">{step.body}</p>
					</div>
				</li>
			))}
		</ol>
	)

	return (
		<div className="flex flex-col gap-12">
			<div className="grid items-start gap-16 lg:grid-cols-[5fr_6fr] lg:gap-24">
				<div className={cn(touring && 'top-below-nav sticky')}>
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
					{touring && <div className="mt-12">{steps}</div>}
				</div>

				{touring ? (
					<HomeSceneTour
						scene={scene}
						stations={COPY.steps.length}
						label={COPY.heading}
						onStation={setStation}
						onUnavailable={() => setUnavailable(true)}
					/>
				) : (
					steps
				)}
			</div>

			<p className="text-muted-foreground text-body-sm" data-reveal>
				{COPY.note}
			</p>
		</div>
	)
}
