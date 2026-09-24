import { GithubLogo } from '@shared/components/assets/icons/github-logo'
import { Button } from '@shared/components/ui/button'
import { Link } from 'react-router'

import {
	HOME_PAGE_COPY,
	OPEN_SOURCE_PACKAGES
} from '../../constants/product-copy'

const COPY = HOME_PAGE_COPY.openSource

/*
  Literal colors, deliberately outside the token system.

  The panel is a picture of someone else's interface: macOS window controls
  and a Tokyo Night editor. An editor theme does not change with the page it is
  shown on, so the panel stays dark in both site themes, and tokenizing these
  would be the bug, not the fix. Naming them says so, and gives the lint rule
  something to allowlist.

  The string color is the one exception: it is the brand orange, so the
  package name is the thing the eye lands on.
*/
const WINDOW_CONTROLS = {
	close: '#ff5f57',
	minimize: '#febc2e',
	zoom: '#28c840'
} as const

const EDITOR = {
	background: '#1a1b26',
	text: '#c0caf5',
	comment: '#9aa5ce',
	keyword: '#7aa2f7',
	component: '#e0af68',
	attribute: '#9ece6a'
} as const

const CodeWindow = () => (
	<div
		className="overflow-hidden rounded-2xl"
		style={{ background: EDITOR.background, color: EDITOR.text }}
	>
		<div className="flex items-center gap-2 px-4 py-4">
			<span
				className="size-3 rounded-full"
				style={{ background: WINDOW_CONTROLS.close }}
			/>
			<span
				className="size-3 rounded-full"
				style={{ background: WINDOW_CONTROLS.minimize }}
			/>
			<span
				className="size-3 rounded-full"
				style={{ background: WINDOW_CONTROLS.zoom }}
			/>
			<span className="text-label-xs ml-2" style={{ color: EDITOR.comment }}>
				your-app.tsx
			</span>
		</div>
		<pre
			tabIndex={0}
			role="region"
			aria-label="Installing and using @vctrl/viewer"
			className="text-body-sm overflow-x-auto px-6 pt-2 pb-8 font-mono leading-relaxed"
		>
			<code>
				<span style={{ color: EDITOR.comment }}>
					{'# Install the viewer\n'}
				</span>
				{'pnpm add '}
				<span className="text-orange">{'@vctrl/viewer\n\n'}</span>
				<span style={{ color: EDITOR.comment }}>
					{'// Drop a model into any React app\n'}
				</span>
				<span style={{ color: EDITOR.keyword }}>{'import'}</span>
				{' { VectrealViewer } '}
				<span style={{ color: EDITOR.keyword }}>{'from'}</span>
				<span className="text-orange">{" '@vctrl/viewer'\n\n"}</span>
				{'<'}
				<span style={{ color: EDITOR.component }}>{'VectrealViewer'}</span>
				<span style={{ color: EDITOR.attribute }}>{' src'}</span>
				{'='}
				<span className="text-orange">{'{modelUrl}'}</span>
				{' />'}
			</code>
		</pre>
	</div>
)

/**
 * The open-source half of the company, told with what a developer would check
 * first: the license, the packages, and a snippet that works.
 *
 * No star or download counts. They move every day, and a small number stated
 * as proof argues the opposite of what it was put there to say.
 */
export const OpenSourceSection = () => (
	<div className="grid items-start gap-16 lg:grid-cols-2">
		<div className="flex flex-col gap-8">
			<div>
				<h2 id="open-source-heading" className="text-h2" data-reveal="wipe">
					{COPY.heading}
				</h2>
				<p
					className="text-muted-foreground text-body-lg mt-4"
					data-reveal="fade"
				>
					{COPY.lead}
				</p>
			</div>

			<ul className="flex flex-col" data-reveal="fade">
				{OPEN_SOURCE_PACKAGES.map((pkg) => (
					<li key={pkg.name} className="flex flex-col gap-1 py-4">
						<Link
							to={new URL(pkg.docs).pathname}
							className="text-foreground text-body-sm w-fit font-mono underline-offset-4 hover:underline"
						>
							{pkg.name}
						</Link>
						<span className="text-muted-foreground text-body-sm">
							{pkg.description}
						</span>
					</li>
				))}
			</ul>

			<div className="flex flex-wrap gap-4" data-reveal="fade">
				<Button asChild>
					<a href={COPY.repositoryUrl} target="_blank" rel="noreferrer">
						<GithubLogo className="size-4" />
						{COPY.repositoryCta}
						<span className="sr-only"> (opens in a new tab)</span>
					</a>
				</Button>
				<Button asChild variant="ghost">
					<a href={COPY.discordUrl} target="_blank" rel="noreferrer">
						{COPY.discordCta}
						<span className="sr-only"> (opens in a new tab)</span>
					</a>
				</Button>
				<Button asChild variant="ghost">
					<Link to="/docs/contributing">{COPY.contributingCta}</Link>
				</Button>
			</div>
		</div>

		<div data-reveal="fade">
			<CodeWindow />
		</div>
	</div>
)
