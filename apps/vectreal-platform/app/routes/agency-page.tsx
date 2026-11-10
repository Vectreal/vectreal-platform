import { Button } from '@shared/components/ui/button'
import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router'

import { PublicErrorBoundary } from '../components/errors'
import { CtaPanel, PageHero, SheetFrame } from '../components/layout-components'
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
	return {
		letterCode,
		letter: await resolveIntakeLetter(request, raw)
	}
}

export function meta({ error }: Route.MetaArgs) {
	if (error) return routeErrorMeta(error)
	return buildPageMeta(
		{ ...COPY.meta, canonical: MODEL_INTAKE_AGENCY_PAGE_PATH },
		undefined,
		{ private: true, locale: 'de_DE' }
	)
}

function RequestButton({ to }: { to: string }) {
	return (
		<Button
			asChild
			size="lg"
			variant="brand"
			className="tap-target w-full sm:w-fit"
		>
			<Link to={to}>
				{COPY.action}
				<ArrowRight aria-hidden="true" />
			</Link>
		</Button>
	)
}

const BAND = 'border-foreground/10 border-t'
const PARAGRAPH = 'text-body text-muted-foreground max-w-3xl'

export default function AgencyPage({ loaderData }: Route.ComponentProps) {
	const { letterCode, letter } = loaderData
	const formPath = letterCode
		? intakeLetterFormPath(letterCode, 'de')
		: '/free-model?lang=de'

	return (
		<main lang="de">
			<PageHero
				heading={COPY.hero.heading}
				description={
					letter
						? `${COPY.letterGreeting(letter.organization)} ${COPY.hero.description}`
						: COPY.hero.description
				}
			/>

			<SheetFrame>
				<div className={BAND}>
					<div className="mx-(--frame-x) grid lg:grid-cols-2">
						<section className="border-foreground/10 space-y-4 py-16 lg:border-r lg:px-(--frame-pad) lg:py-24">
							<h2 className="text-h4">{COPY.audience.heading}</h2>
							{COPY.audience.paragraphs.map((text) => (
								<p key={text} className={PARAGRAPH}>
									{text}
								</p>
							))}
						</section>
						<section className="border-foreground/10 space-y-4 border-t py-16 lg:border-t-0 lg:px-(--frame-pad) lg:py-24">
							<h2 className="text-h4">{COPY.offer.heading}</h2>
							{COPY.offer.paragraphs.map((text) => (
								<p key={text} className={PARAGRAPH}>
									{text}
								</p>
							))}
							<div className="pt-2">
								<RequestButton to={formPath} />
							</div>
						</section>
					</div>
				</div>

				<section className={BAND}>
					<div className="mx-(--frame-x) space-y-8 py-16 lg:px-(--frame-pad) lg:py-24">
						<div className="space-y-4">
							<h2 className="text-h4">{COPY.inStore.heading}</h2>
							<p className={PARAGRAPH}>{COPY.inStore.intro}</p>
						</div>
						<div className="grid gap-8 lg:grid-cols-3">
							{COPY.inStore.ways.map((way) => (
								<div key={way.label} className="space-y-4">
									{way.paragraphs.map((text, index) => (
										<p key={text} className={PARAGRAPH}>
											{index === 0 ? (
												<strong className="text-foreground font-medium">
													{way.label}{' '}
												</strong>
											) : null}
											{text}
										</p>
									))}
								</div>
							))}
						</div>
						<p className={PARAGRAPH}>{COPY.inStore.closing}</p>
						<Link
							to={COPY.inStore.link.href}
							className="text-body-sm decoration-muted-foreground hover:decoration-orange inline-block underline underline-offset-4 transition-colors duration-150"
						>
							{COPY.inStore.link.label}
						</Link>
					</div>
				</section>

				<section className={BAND}>
					<div className="mx-(--frame-x) space-y-6 py-16 lg:px-(--frame-pad) lg:py-24">
						<h2 className="text-h4">{COPY.terms.heading}</h2>
						<ul className="text-body text-muted-foreground max-w-3xl list-disc space-y-2 pl-5">
							{COPY.terms.items.map((item) => (
								<li key={item}>{item}</li>
							))}
						</ul>
						<p className={PARAGRAPH}>{COPY.terms.contact}</p>
					</div>
				</section>

				<div className={BAND}>
					<div className="mx-(--frame-x) space-y-6 py-16 lg:px-(--frame-pad) lg:py-24">
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
		</main>
	)
}

export { PublicErrorBoundary as ErrorBoundary }
