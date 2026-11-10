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
import { resolveIntakeScene } from '../lib/domain/model-intake/model-intake-scene.server'
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
	// An agency letter shows no showcase, so the page turns the default scene.
	const [letter, scene] = await Promise.all([
		resolveIntakeLetter(request, raw),
		resolveIntakeScene(request, null)
	])
	return { letterCode, letter, scene }
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
const SECTION = 'mx-(--frame-x) space-y-6 py-12 lg:px-(--frame-pad) lg:py-20'
const PARAGRAPH = 'text-body text-muted-foreground max-w-3xl'
const LINK =
	'text-body-sm decoration-muted-foreground hover:decoration-orange inline-block underline underline-offset-4 transition-colors duration-150'

/** The loops recorded from the Dawn harness, poster first. */
const wayMedia = (id: string) => ({
	src: `/media/agenturen/${id}.mp4`,
	poster: `/media/agenturen/${id}.webp`
})

export default function AgencyPage({ loaderData }: Route.ComponentProps) {
	const { letterCode, letter, scene } = loaderData
	const formPath = letterCode
		? intakeLetterFormPath(letterCode, 'de')
		: '/free-model?lang=de'

	return (
		<main lang="de">
			<IntakeHero
				greeting={letter ? COPY.letterGreeting(letter.organization) : null}
				heading={COPY.hero.heading}
				lead={COPY.hero.lead}
				scene={scene}
				sceneLabel={COPY.hero.sceneLabel}
				action={<RequestButton to={formPath} />}
			/>

			<SheetFrame>
				<section className={BAND}>
					<div className={SECTION}>
						<h2 className="text-h4">{COPY.steps.heading}</h2>
						<ol className="grid gap-6 lg:grid-cols-3">
							{COPY.steps.items.map((step, index) => (
								<li key={step} className="flex gap-4">
									<span
										aria-hidden="true"
										className="ds-sunken text-body-sm flex size-8 shrink-0 items-center justify-center rounded-full font-medium"
									>
										{index + 1}
									</span>
									<p className="text-body">{step}</p>
								</li>
							))}
						</ol>
					</div>
				</section>

				<section className={BAND}>
					<div className={SECTION}>
						<div className="space-y-2">
							<h2 className="text-h4">{COPY.ways.heading}</h2>
							<p className={PARAGRAPH}>{COPY.ways.intro}</p>
						</div>
						<ul className="grid gap-6 md:grid-cols-3">
							{COPY.ways.items.map((way) => (
								<li key={way.id}>
									<Card className="h-full gap-4 p-4">
										<IntakeLoop {...wayMedia(way.id)} label={way.video} />
										<h3 className="text-body font-medium">{way.label}</h3>
										<p className="text-body-sm text-muted-foreground">
											{way.text}
										</p>
									</Card>
								</li>
							))}
						</ul>
						<Link to={COPY.ways.link.href} className={LINK}>
							{COPY.ways.link.label}
						</Link>
					</div>
				</section>

				<section className={BAND}>
					<div className={SECTION}>
						<Card className="gap-4 p-6 md:p-8">
							<h2 className="text-h4">{COPY.terms.heading}</h2>
							<ul className="text-body grid list-disc gap-x-10 gap-y-2 pl-5 md:grid-cols-2">
								{COPY.terms.items.map((item) => (
									<li key={item}>{item}</li>
								))}
							</ul>
							<p className="text-body-sm text-muted-foreground">
								{COPY.terms.contact}
							</p>
						</Card>
					</div>
				</section>

				<section className={BAND}>
					<div className={SECTION}>
						<h2 className="text-h4">{COPY.faq.heading}</h2>
						<div className="divide-foreground/10 border-foreground/10 max-w-3xl divide-y border-y">
							{COPY.faq.items.map((item) => (
								<details key={item.question} className="py-4">
									<summary className="text-body tap-target cursor-pointer font-medium">
										{item.question}
									</summary>
									<div className="space-y-3 pt-3">
										{item.answer.map((text) => (
											<p key={text} className={PARAGRAPH}>
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
							description={COPY.request.body}
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
