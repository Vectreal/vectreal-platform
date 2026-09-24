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
  The window is drawn in the page's own materials: it sits on the raised step
  of the elevation ladder, the result in a sunken well inside it, and the code
  is grayscale with one accent. It used to be a Tokyo Night editor in literal
  colors, fixed dark: once the page followed the reader's theme, its blue cast
  was the only hue on the page besides the brand orange, and it clashed.

  The strings keep the brand orange, so the package names are what the eye
  lands on. The window controls are an inactive window's gray, for the same
  reason: three more colors would compete with it.
*/
const Comment = ({ children }: { children: string }) => (
	<span className="text-muted-foreground">{children}</span>
)
const Keyword = ({ children }: { children: string }) => (
	<span className="text-muted-foreground">{children}</span>
)
const Name = ({ children }: { children: string }) => (
	<span className="text-foreground font-medium">{children}</span>
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
		<Keyword>{'export function'}</Keyword> <Name>{'ProductView'}</Name>
		{'() {\n  '}
		<Keyword>{'const'}</Keyword>
		{' { scene } = '}
		<Name>{'useGLTF'}</Name>
		{'('}
		<Str>{"'/camera.glb'"}</Str>
		{', '}
		<Str>{"'/draco/'"}</Str>
		{')\n  '}
		<Keyword>{'return'}</Keyword>
		{' <'}
		<Name>{'VectrealViewer'}</Name>
		<Keyword>{' model'}</Keyword>
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
		<div className="text-muted-foreground absolute inset-0 flex items-center justify-center p-10">
			<CameraDrawing className="w-full max-w-sm opacity-40" />
		</div>
	)

	return (
		<div
			role="region"
			aria-label={COPY.result.label}
			// Edge to edge in its half: the window's own corners round it, so it needs no margin or radius of its own.
			className="ds-sunken relative aspect-16/10 lg:aspect-auto"
		>
			<span className="text-label-xs text-muted-foreground absolute top-4 left-5">
				{COPY.result.label}
			</span>
			{state === 'running' ? (
				<StageBoundary onError={() => setState('failed')}>
					<Suspense fallback={drawing}>
						{/* Out of flow: the viewer fills its container, so in flow it would size the well it sits in, and the row with it. */}
						<div className="absolute inset-0">
							<SnippetResult />
						</div>
					</Suspense>
				</StageBoundary>
			) : (
				<>
					{drawing}
					<Button
						type="button"
						size="sm"
						onClick={run}
						className="absolute right-4 bottom-4 rounded-full"
					>
						<Play className="size-3.5" aria-hidden="true" />
						{state === 'failed' ? COPY.result.failed : COPY.result.run}
					</Button>
				</>
			)}
		</div>
	)
}

const CodeWindow = () => (
	// Split the way a playground is, from lg: the editor with its title bar on the left, its output the full height of the right half. Stacked below that.
	<div className="ds-raised text-foreground grid overflow-hidden rounded-2xl lg:grid-cols-2">
		<div className="min-w-0">
			<div className="flex items-center gap-2 px-4 py-4" aria-hidden="true">
				<span className="bg-foreground/15 size-3 rounded-full" />
				<span className="bg-foreground/15 size-3 rounded-full" />
				<span className="bg-foreground/15 size-3 rounded-full" />
				<span className="text-label-xs text-muted-foreground ml-2">
					product-view.tsx
				</span>
			</div>
			<pre
				tabIndex={0}
				role="region"
				aria-label="Installing and using @vctrl/viewer"
				className="text-body-sm overflow-x-auto px-6 pt-2 pb-8 font-mono leading-relaxed whitespace-pre"
			>
				<Code />
			</pre>
		</div>
		<Result />
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
