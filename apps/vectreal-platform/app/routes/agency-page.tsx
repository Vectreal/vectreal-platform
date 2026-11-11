import { Button } from '@shared/components/ui/button'
import { Card } from '@shared/components/ui/card'
import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router'

import { PublicErrorBoundary } from '../components/errors'
import { CtaPanel, SheetFrame } from '../components/layout-components'
import { IntakeHero } from '../components/model-intake/intake-hero'
import { IntakeLoop } from '../components/model-intake/intake-loop'
import {
	INTAKE_ACTION_ATTRIBUTE,
	IntakeStickyAction
} from '../components/model-intake/intake-sticky-action'
import { routeErrorMeta } from '../components/not-found'
import { AGENCY_PAGE_COPY as COPY } from '../constants/agency-page-copy'
import { resolveIntakeLetter } from '../lib/domain/model-intake/model-intake-letter.server'
import {
	intakeLetterFormPath,
	MODEL_INTAKE_AGENCY_PAGE_PATH,
	MODEL_INTAKE_LETTER_PARAM,
	normalizeIntakeLetterCode
} from '../lib/domain/model-intake/model-intake-shared'
import { buildPageMeta } from '../lib/seo'

import type { Route } from './+types/agency-page'

/*
  Where an agency letter's short address forwards. It greets the agency by the
  letter's code through the same rate-limited lookup as the form, and carries
  the code on to the form, so the request still names the letter it came from.
  Not in the sitemap, the nav or the cacheable paths: reachable from a letter
  only, and the greeting makes the HTML per visitor.
*/
export async function loader({ request }: Route.LoaderArgs) {
	const raw = new URL(request.url).searchParams.get(MODEL_INTAKE_LETTER_PARAM)
	const letterCode = normalizeIntakeLetterCode(raw)
	const letter = await resolveIntakeLetter(request, raw)
	return { letterCode, letter }
}

export function meta({ error }: Route.MetaArgs) {
	if (error) return routeErrorMeta(error)
	return buildPageMeta(
		{ ...COPY.meta, canonical: MODEL_INTAKE_AGENCY_PAGE_PATH },
		undefined,
		{ private: true, locale: 'de_DE' }
	)
}

function RequestButton({
	to,
	sticky = false
}: {
	to: string
	/** The sticky copy is the one the others hide; it does not count as one of them. */
	sticky?: boolean
}) {
	return (
		<Button
			asChild
			size="lg"
			variant="brand"
			className="tap-target w-full sm:w-fit"
			{...(sticky ? {} : { [INTAKE_ACTION_ATTRIBUTE]: '' })}
		>
			<Link to={to}>
				{COPY.action}
				<ArrowRight aria-hidden="true" />
			</Link>
		</Button>
	)
}

const BAND = 'border-foreground/10 border-t'
const SECTION = 'mx-(--frame-x) space-y-8 py-12 lg:px-(--frame-pad) lg:py-20'
const LINK =
	'text-body-sm decoration-muted-foreground hover:decoration-orange inline-block underline underline-offset-4 transition-colors duration-150'

const MEDIA = '/media/agenturen'

export default function AgencyPage({ loaderData }: Route.ComponentProps) {
	const { letterCode, letter } = loaderData
	const formPath = letterCode
		? intakeLetterFormPath(letterCode, 'de')
		: '/free-model?lang=de'

	return (
		<main lang="de">
			<IntakeHero
				greeting={letter ? COPY.letterGreeting(letter.organization) : null}
				heading={COPY.hero.heading}
				lead={COPY.hero.lead}
				media={
					// The test page on a phone. A phone shows the middle of it, where the product turns, so the button stays on the first screen.
					<IntakeLoop
						src={`${MEDIA}/agentur-hero.mp4`}
						poster={`${MEDIA}/agentur-hero.webp`}
						label={COPY.hero.video}
						priority
						className="border-foreground/15 aspect-square rounded-3xl border-4 lg:mx-auto lg:aspect-390/844 lg:max-w-xs"
					/>
				}
				action={<RequestButton to={formPath} />}
			/>

			<SheetFrame>
				<section className={BAND}>
					<div className={SECTION}>
						<h2 className="text-h2">{COPY.steps.heading}</h2>
						<ol className="grid gap-8 md:grid-cols-3">
							{COPY.steps.items.map((step, index) => (
								<li key={step.id} className="space-y-3">
									<img
										src={`${MEDIA}/step-${step.id}.webp`}
										alt={step.image}
										width={640}
										height={480}
										loading="lazy"
										className="ds-sunken aspect-4/3 w-full rounded-xl object-cover"
									/>
									<p className="text-body flex gap-3">
										<span aria-hidden="true" className="font-medium">
											{index + 1}
										</span>
										{step.text}
									</p>
								</li>
							))}
						</ol>
					</div>
				</section>

				<section className={BAND}>
					<div className={SECTION}>
						<h2 className="text-h2">{COPY.ways.heading}</h2>
						<ul className="grid gap-6 md:grid-cols-2">
							{COPY.ways.items.map((way) => (
								<li key={way.id}>
									<Card className="h-full gap-4 p-4">
										<IntakeLoop
											src={`${MEDIA}/${way.id}.mp4`}
											poster={`${MEDIA}/${way.id}.webp`}
											label={way.video}
										/>
										<h3 className="text-h4">{way.label}</h3>
										<p className="text-body-sm text-muted-foreground">
											{way.text}
										</p>
									</Card>
								</li>
							))}
						</ul>
					</div>
				</section>

				<section className={BAND}>
					<div className={SECTION}>
						<h2 className="text-h2">{COPY.terms.heading}</h2>
						<p
							aria-hidden="true"
							className="text-headline grid gap-2 md:grid-cols-3"
						>
							{COPY.terms.figures.map((figure) => (
								<span key={figure}>{figure}</span>
							))}
						</p>
						<ul className="text-body grid list-disc gap-2 pl-5">
							{COPY.terms.lines.map((line) => (
								<li key={line}>{line}</li>
							))}
						</ul>
					</div>
				</section>

				<section className={BAND}>
					<div className={SECTION}>
						<h2 className="text-h2">{COPY.faq.heading}</h2>
						<div className="grid gap-x-12 md:grid-cols-2">
							{COPY.faq.items.map((item) => (
								<details
									key={item.question}
									className="border-foreground/10 border-b py-4"
								>
									<summary className="text-body tap-target cursor-pointer font-medium">
										{item.question}
									</summary>
									<div className="space-y-3 pt-3">
										{item.answer.map((text) => (
											<p key={text} className="text-body text-muted-foreground">
												{text}
											</p>
										))}
										{'link' in item && item.link ? (
											<Link to={item.link.href} className={LINK}>
												{item.link.label}
											</Link>
										) : null}
									</div>
								</details>
							))}
						</div>
					</div>
				</section>

				<div className={BAND}>
					<div className={SECTION}>
						<CtaPanel
							heading={COPY.request.heading}
							description={COPY.request.contact}
							actions={<RequestButton to={formPath} />}
						/>
						<p className="text-body text-muted-foreground">
							{COPY.request.signature}
						</p>
					</div>
				</div>
			</SheetFrame>

			<IntakeStickyAction>
				<RequestButton to={formPath} sticky />
			</IntakeStickyAction>
		</main>
	)
}

export { PublicErrorBoundary as ErrorBoundary }
