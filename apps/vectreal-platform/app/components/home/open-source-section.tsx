import { GithubLogo } from '@shared/components/assets/icons/github-logo'
import { Button } from '@shared/components/ui/button'
import { Play } from 'lucide-react'
import { lazy, Suspense, useState } from 'react'
import { Link } from 'react-router'

import { CameraDrawing } from './camera-drawing'
import { StageBoundary } from './hero/stage-boundary'
import {
	HOME_PAGE_COPY,
	OPEN_SOURCE_PACKAGES
} from '../../constants/product-copy'

const COPY = HOME_PAGE_COPY.openSource

// A function, not one module-level `lazy`: React caches a rejected import, so a retry after a failed chunk needs a fresh one.
const loadResult = () => lazy(() => import('./snippet-result-client'))
// The model loader keeps a failed load and throws it again on every render, so a retry forgets it first.
const reloadResult = () =>
	lazy(() =>
		import('./snippet-result-client').then((module) => {
			module.forgetModel()
			return module
		})
	)

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
	/** Tokyo Night's darker panel, under the editor: the result sits below the code the way a preview pane does. */
	panel: '#16161e',
	text: '#c0caf5',
	comment: '#9aa5ce',
	keyword: '#7aa2f7',
	component: '#e0af68',
	attribute: '#9ece6a'
} as const

const Comment = ({ children }: { children: string }) => (
	<span style={{ color: EDITOR.comment }}>{children}</span>
)
const Keyword = ({ children }: { children: string }) => (
	<span style={{ color: EDITOR.keyword }}>{children}</span>
)
const Str = ({ children }: { children: string }) => (
	<span className="text-orange">{children}</span>
)

/*
  The code is what the Result pane runs, so it has to be code that works as
  written: `three` is the viewer's peer and has to be installed alongside it,
  `model` takes a loaded scene rather than a URL, and the camera is Draco
  compressed, so the loader is pointed at a decoder the site serves itself.
*/
const Code = () => (
	<code>
		<Comment>{'# Install the viewer and what your code imports\n'}</Comment>
		{'pnpm add '}
		<Str>{'@vctrl/viewer three @react-three/drei\n\n'}</Str>
		<Keyword>{'import'}</Keyword>
		{' { useGLTF } '}
		<Keyword>{'from'}</Keyword>
		<Str>{" '@react-three/drei'\n"}</Str>
		<Keyword>{'import'}</Keyword>
		{' { VectrealViewer } '}
		<Keyword>{'from'}</Keyword>
		<Str>{" '@vctrl/viewer'\n"}</Str>
		<Keyword>{'import'}</Keyword>
		<Str>{" '@vctrl/viewer/css'\n\n"}</Str>
		<Keyword>{'export function'}</Keyword>{' '}
		<span style={{ color: EDITOR.component }}>{'ProductView'}</span>
		{'() {\n  '}
		<Keyword>{'const'}</Keyword>
		{' { scene } = '}
		<span style={{ color: EDITOR.keyword }}>{'useGLTF'}</span>
		{'('}
		<Str>{"'/camera.glb'"}</Str>
		{', '}
		<Str>{"'/draco/'"}</Str>
		{')\n  '}
		<Keyword>{'return'}</Keyword>
		{' <'}
		<span style={{ color: EDITOR.component }}>{'VectrealViewer'}</span>
		<span style={{ color: EDITOR.attribute }}>{' model'}</span>
		{'={scene} />\n}'}
	</code>
)

type RunState = 'idle' | 'running' | 'failed'

/**
 * The snippet's result, under it, in the same window.
 *
 * Until the reader asks, it holds the camera's line drawing and costs nothing:
 * running it loads the real viewer, about 210 KB gzipped beyond what the hero
 * already loaded, which only someone who pressed Run should pay for. What mounts is the snippet's own component,
 * so the pane proves the code rather than illustrating it. The drawing stays
 * while the viewer loads, and comes back with a retry if it fails.
 */
const Result = () => {
	const [state, setState] = useState<RunState>('idle')
	const [SnippetResult, setSnippetResult] = useState(loadResult)

	const run = () => {
		if (state === 'failed') setSnippetResult(reloadResult)
		setState('running')
	}

	const drawing = (
		<div
			className="flex h-full items-center justify-center p-10"
			style={{ color: EDITOR.comment }}
		>
			<CameraDrawing className="w-full max-w-sm opacity-40" />
		</div>
	)

	return (
		<div
			role="region"
			aria-label={COPY.result.label}
			className="relative aspect-16/10 lg:aspect-auto lg:h-full"
			style={{ background: EDITOR.panel }}
		>
			<span
				className="text-label-xs absolute top-4 left-6"
				style={{ color: EDITOR.comment }}
			>
				{COPY.result.label}
			</span>
			{state === 'running' ? (
				<StageBoundary onError={() => setState('failed')}>
					<Suspense fallback={drawing}>
						<SnippetResult />
					</Suspense>
				</StageBoundary>
			) : (
				<>
					{drawing}
					<button
						type="button"
						onClick={run}
						className="text-body-sm focus-visible:ring-orange absolute right-4 bottom-4 inline-flex items-center gap-2 rounded-full px-4 py-2 transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:outline-none"
						style={{ color: EDITOR.background, background: EDITOR.text }}
					>
						<Play className="size-3.5" aria-hidden="true" />
						{state === 'failed' ? COPY.result.failed : COPY.result.run}
					</button>
				</>
			)}
		</div>
	)
}

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
				product-view.tsx
			</span>
		</div>
		{/* Side by side from lg, the way a playground sets code and its output; stacked below that. */}
		<div className="grid lg:grid-cols-2">
			<pre
				tabIndex={0}
				role="region"
				aria-label="Installing and using @vctrl/viewer"
				className="text-body-sm overflow-x-auto px-6 pt-2 pb-8 font-mono leading-relaxed whitespace-pre"
			>
				<Code />
			</pre>
			<Result />
		</div>
	</div>
)

/**
 * The open-source half of the company, told with what a developer would check
 * first: the license, the packages, and a snippet that runs.
 *
 * No star or download counts. They move every day, and a small number stated
 * as proof argues the opposite of what it was put there to say.
 */
export const OpenSourceSection = () => (
	<div className="flex flex-col gap-12">
		<div className="grid items-end gap-8 lg:grid-cols-2 lg:gap-16">
			<div>
				<h2 id="open-source-heading" className="text-h2" data-reveal>
					{COPY.heading}
				</h2>
				<p className="text-muted-foreground text-body-lg mt-4" data-reveal>
					{COPY.lead}
				</p>
			</div>

			<div className="flex flex-col gap-8">
				<div data-reveal>
					<h3 className="text-eyebrow text-muted-foreground">
						{COPY.packagesLabel}
					</h3>
					<ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
						{OPEN_SOURCE_PACKAGES.map((pkg) => (
							<li key={pkg.name}>
								<Link
									to={new URL(pkg.docs).pathname}
									title={pkg.description}
									className="text-foreground text-body-sm font-mono underline-offset-4 hover:underline"
								>
									{pkg.name}
								</Link>
							</li>
						))}
					</ul>
				</div>

				<div className="flex flex-wrap gap-4" data-reveal>
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
		</div>

		<div data-reveal>
			<CodeWindow />
		</div>
	</div>
)
