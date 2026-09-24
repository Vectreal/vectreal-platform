import { DiscordLogo } from '@shared/components/assets/icons/discord-logo'
import { GithubMark } from '@shared/components/assets/icons/github-mark'
import { RedditLogo } from '@shared/components/assets/icons/reddit-logo'
import { VectrealLogoAnimated } from '@shared/components/assets/icons/vectreal-logo-animated'
import { XLogo } from '@shared/components/assets/icons/x-logo'
import { YoutubeLogo } from '@shared/components/assets/icons/youtube-logo'
import { Link } from 'react-router'

import { useConsent } from './consent/consent-context'
import { ThemeToggleButton } from './theme-toggle-button'
import { COMMUNITY, FOOTER, type SiteLink } from '../lib/navigation/site-map'

const SOCIAL = [
	{ label: 'GitHub', href: COMMUNITY.github, Icon: GithubMark },
	{ label: 'Discord', href: COMMUNITY.discord, Icon: DiscordLogo },
	{ label: 'Reddit', href: COMMUNITY.reddit, Icon: RedditLogo },
	{ label: 'YouTube', href: COMMUNITY.youtube, Icon: YoutubeLogo },
	{ label: 'X', href: COMMUNITY.x, Icon: XLogo }
] as const

const LINK_CLASS =
	'text-muted-foreground hover:text-foreground text-body-sm transition-colors'

const FooterLink = ({ link }: { link: SiteLink }) =>
	link.external ? (
		<a href={link.to} target="_blank" rel="noreferrer" className={LINK_CLASS}>
			{link.label}
		</a>
	) : (
		<Link to={link.to} className={LINK_CLASS}>
			{link.label}
		</Link>
	)

/**
 * The whole site, once more, for a reader who scrolled to the end looking for
 * something the page did not show them.
 *
 * Every column comes from the site map, so the footer and the nav cannot name
 * a page two ways or forget one. It is grouped by type and space alone: the
 * lines it used to draw between rows separated nothing that alignment did not
 * already separate.
 */
export const Footer = () => {
	const { setPreferencesOpen } = useConsent()

	return (
		<footer className="bg-background w-full">
			<div className="container-page flex flex-col gap-16 pt-32 pb-10">
				<div className="flex max-w-md flex-col gap-4">
					<Link to="/" aria-label="Home" className="w-32">
						<VectrealLogoAnimated className="h-auto w-full" />
					</Link>
					<p className="text-muted-foreground text-body-sm">{FOOTER.tagline}</p>
				</div>

				<nav
					aria-label="Site"
					className="grid grid-cols-2 gap-x-6 gap-y-12 sm:grid-cols-3 lg:grid-cols-5"
				>
					{FOOTER.sections.map((section) => (
						<div key={section.label}>
							<h2 className="text-eyebrow text-muted-foreground">
								{section.label}
							</h2>
							<ul className="mt-4 flex flex-col gap-3">
								{section.links.map((link) => (
									<li key={link.to}>
										<FooterLink link={link} />
									</li>
								))}
							</ul>
						</div>
					))}
				</nav>

				<div className="text-muted-foreground flex flex-col-reverse gap-6 sm:flex-row sm:items-center sm:justify-between">
					<small className="text-body-sm">
						© {new Date().getFullYear()} Vectreal
					</small>
					<div className="flex flex-wrap items-center gap-x-6 gap-y-4">
						<ul className="flex items-center gap-4">
							{SOCIAL.map(({ label, href, Icon }) => (
								<li key={label}>
									<a
										href={href}
										target="_blank"
										rel="noreferrer"
										aria-label={label}
										className="hover:text-foreground block transition-colors"
									>
										<Icon className="size-4" />
									</a>
								</li>
							))}
						</ul>
						<button
							type="button"
							className="text-body-sm hover:text-foreground transition-colors"
							onClick={() => setPreferencesOpen(true)}
						>
							Cookie preferences
						</button>
						<ThemeToggleButton />
					</div>
				</div>
			</div>
		</footer>
	)
}
