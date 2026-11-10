import { VectrealLogoAnimated } from '@shared/components/assets/icons/vectreal-logo-animated'
import { cn } from '@shared/utils'
import { Link, useLocation } from 'react-router'

import { MODEL_INTAKE_CHROME_COPY } from '../../constants/model-intake-chrome-copy'
import {
	intakePageLocale,
	MODEL_INTAKE_PATH
} from '../../lib/domain/model-intake/model-intake-shared'

const LINK_CLASS =
	'text-muted-foreground hover:text-orange-ink focus-visible:text-orange-ink text-body-sm tap-target relative underline-offset-4 transition-colors'

function useIntakeChrome() {
	const { pathname, search } = useLocation()
	const locale = intakePageLocale(pathname, search) ?? 'en'
	return { pathname, search, locale, copy: MODEL_INTAKE_CHROME_COPY[locale] }
}

/**
 * The letter funnel's header: the logo and, where the page has a second
 * language, the switch to it. It overlays the hero like the site nav does, so
 * the page keeps the hero's spacing. The agency page is German only, so it has
 * no switch.
 */
export function IntakeHeader() {
	const { pathname, search, locale, copy } = useIntakeChrome()
	const otherLocale = locale === 'de' ? 'en' : 'de'
	// Everything else in the address (the letter code, the batch) rides along.
	const switchSearch = new URLSearchParams(search)
	switchSearch.set('lang', otherLocale)

	return (
		<header className="z-nav absolute inset-x-0 top-0">
			<div className="container-page flex items-center justify-between gap-6 py-4">
				<Link
					to="/"
					className="flex shrink-0 items-center py-1"
					aria-label={copy.home}
				>
					<VectrealLogoAnimated className="text-muted-foreground h-6" colored />
				</Link>
				{pathname === MODEL_INTAKE_PATH ? (
					<Link
						to={`?${switchSearch.toString()}`}
						hrefLang={otherLocale}
						lang={otherLocale}
						className={cn(LINK_CLASS, 'underline')}
					>
						{copy.languageLink}
					</Link>
				) : null}
			</div>
		</header>
	)
}

/** The funnel's footer: the two pages German law asks every page to reach. */
export function IntakeFooter() {
	const { locale, copy } = useIntakeChrome()

	return (
		<footer lang={locale} className="bg-background w-full">
			<nav className="container-page flex flex-wrap gap-x-6 gap-y-2 py-10">
				<Link to="/imprint" className={LINK_CLASS}>
					{copy.imprint}
				</Link>
				<Link to="/privacy-policy" className={LINK_CLASS}>
					{copy.privacy}
				</Link>
			</nav>
		</footer>
	)
}
