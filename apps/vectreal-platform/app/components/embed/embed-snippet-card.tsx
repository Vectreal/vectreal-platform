import { Button } from '@shared/components/ui/button'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger
} from '@shared/components/ui/dropdown-menu'
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger
} from '@shared/components/ui/tabs'
import { cn } from '@shared/utils'
import { ChevronDown, Copy, ExternalLink } from 'lucide-react'
import { useState, type FC } from 'react'

import { useClipboardCopy } from '../../hooks/use-clipboard-copy'
import { EMBED_COPY } from '../../lib/domain/embed/embed-snippet'

/**
 * The three ways to take the same embed away.
 *
 * They used to be two parcels: an `Embed URL` section with its own input, copy
 * button and caption, and an `Embed Code` section with HTML and SDK tabs - as
 * though the URL were a second thing to configure rather than the same artifact
 * with the markup stripped off. It is one artifact and three views of it.
 */
const VIEWS = [
	{
		id: 'html',
		tab: EMBED_COPY.tabHtml,
		copy: EMBED_COPY.copyHtml,
		success: EMBED_COPY.copyHtmlSuccess,
		failure: EMBED_COPY.copyHtmlFailure
	},
	{
		id: 'sdk',
		tab: EMBED_COPY.tabSdk,
		copy: EMBED_COPY.copySdk,
		success: EMBED_COPY.copySdkSuccess,
		failure: EMBED_COPY.copySdkFailure
	},
	{
		id: 'url',
		tab: EMBED_COPY.tabUrl,
		copy: EMBED_COPY.copyUrl,
		success: EMBED_COPY.copyUrlSuccess,
		failure: EMBED_COPY.copyUrlFailure
	}
] as const

type ViewId = (typeof VIEWS)[number]['id']

interface EmbedSnippetCardProps {
	/** One string per view. Empty until a key is selected. */
	code: Record<ViewId, string>
	/** Whether there is a snippet to copy at all: a key is selected. */
	ready: boolean
	onTest: () => void
}

export const EmbedSnippetCard: FC<EmbedSnippetCardProps> = ({
	code,
	ready,
	onTest
}) => {
	const [view, setView] = useState<ViewId>('html')
	const clipboard = useClipboardCopy()

	const active = VIEWS.find((candidate) => candidate.id === view) ?? VIEWS[0]

	const copyView = (target: (typeof VIEWS)[number]) => {
		/*
		  Guarded on the value, not only on the controls being disabled. Radix
		  keeps an open menu mounted whatever its trigger does, and `disabled` on a
		  menu item is `aria-disabled` plus `pointer-events-none` - which stops a
		  real pointer and nothing else. A key revoked in another tab arrives on a
		  revalidation, `token` empties, and without this `writeText('')` resolves
		  and the toast reports a snippet copied.
		*/
		const value = code[target.id]
		if (!value) return

		void clipboard.copy(target.id, value, {
			success: target.success,
			failure: target.failure,
			unavailable: EMBED_COPY.clipboardUnavailable
		})
	}

	return (
		<Tabs value={view} onValueChange={(next) => setView(next as ViewId)}>
			<TabsList className="w-full">
				{VIEWS.map((candidate) => (
					/*
					  Marked by its border, not by a background.

					  The primitive's own active background is `bg-background/50!`, and
					  tailwind-merge folds the important flag into the class id, so an
					  override without it is kept alongside rather than replacing it -
					  and then loses to `!important`. Any `bg-*` here is inert. The
					  border is not: the base is `border-transparent` with no important
					  flag, and a `data-[state=active]` variant outranks it on
					  specificity.

					  This matters more than it did, because the tab now decides which of
					  three different things the Copy button hands over, and the
					  primitive's own marker measures 1.02:1 to 1.17:1 between states.

					  Deliberately no `text-muted-foreground` on the inactive tabs: it
					  reads as the obvious way to separate them and takes them from 19:1
					  to 4.2:1, which fails 1.4.3 in the publisher once the shell is
					  over a dark model.
					*/
					<TabsTrigger
						key={candidate.id}
						value={candidate.id}
						className="data-[state=active]:border-primary flex-1"
					>
						{candidate.tab}
					</TabsTrigger>
				))}
			</TabsList>

			{/*
			  One frame, with the controls in a header row above the code.

			  The copy button used to float over the snippet - `absolute top-2
			  right-2` with a translucent backdrop - covering the first line of the
			  thing it copies. Nothing else in the app does that; the house geometry
			  is a bordered frame with a `border-b` toolbar and the `pre` beneath it,
			  as `home-page.tsx` draws it.

			  `rounded-xl`, not `rounded-2xl`: `globals.css` puts panels on `2xl`
			  and blocks nested inside one on `xl`, and both hosts are already a
			  panel. No `mt-2` either - `Tabs` is `flex flex-col gap-2`, and a
			  margin on top of a gap adds rather than replaces.
			*/}
			<div className="overflow-hidden rounded-xl border">
				{/*
				  `flex-wrap` because this row cannot shrink: every control carries
				  `whitespace-nowrap`, and under `justify-end` inside `overflow-hidden`
				  an overflow is clipped at the *start* edge - so the test button
				  disappeared silently below a ~340px viewport rather than the row
				  breaking visibly.

				  The tint belongs here and not on the frame. `ds-sunken` was wrong
				  either way - the `ds-*` ladder mixes against `--background`, which
				  neither host is - but tinting the whole frame put `--border` on top
				  of a surface it nearly matches, and the publisher lost the toolbar
				  divider in light and the frame's outer edge in dark. On the toolbar
				  alone it separates the controls from the code and leaves both
				  borders drawing against the host.
				*/}
				<div className="publisher-shell-nested flex flex-wrap items-center justify-end gap-1 border-b px-2 py-1.5">
					<Button
						variant="ghost"
						size="sm"
						onClick={onTest}
						disabled={!ready}
						title={EMBED_COPY.testEmbedUrl}
						aria-label={EMBED_COPY.testEmbedUrl}
					>
						<ExternalLink />
					</Button>

					{/*
					  Split, so "just the URL" is one menu item rather than a section.
					  Shape copied from `optimize-button.tsx`, with one thing not
					  copied: its caret trigger has no accessible name, so the only
					  control that opens the menu is unreachable by anyone not looking
					  at it.
					*/}
					<div className="flex">
						{/*
						  `default`, not `secondary`. This is the panel's primary action and
						  `bg-secondary` measures 1.01:1 to 1.31:1 against every neutral
						  surface in the app - in the dark publisher the button, the caret,
						  the toolbar and the frame border are all the same value, so the
						  control simply is not there. `default` measures 14.5:1 or better
						  in all four host-and-theme combinations.
						*/}
						<Button
							size="sm"
							className="rounded-r-none"
							onClick={() => copyView(active)}
							disabled={!ready}
						>
							<Copy />
							{clipboard.copiedId === active.id
								? EMBED_COPY.copied
								: active.copy}
						</Button>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								{/*
								  The divider is a tint of the button's own foreground. A plain
								  `border-l` is `--border`, which is the same oklch value as
								  `--secondary` in dark mode - a 1:1 seam, so the two halves
								  read as one wide pill and nothing but the chevron says a
								  menu exists. `/60` after two attempts under the bar: `/20`
								  measured 1.57:1 and 1.89:1, `/40` cleared it in light at
								  3.71:1 and still missed dark at 2.53:1. `/60` is 4.62:1,
								  clear of the 3:1 WCAG 1.4.11 asks of a control boundary in
								  both themes.
								*/}
								<Button
									size="sm"
									className="border-l-primary-foreground/60 rounded-l-none border-l px-2"
									disabled={!ready}
									aria-label={EMBED_COPY.copyOptions}
								>
									<ChevronDown />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end" sideOffset={6}>
								{VIEWS.map((candidate) => (
									/*
									  Disabled per item, not only on the trigger. Radix keeps an
									  open menu mounted regardless of its trigger's state, so a
									  key that goes revoked on a revalidation while the menu is
									  open left three live items over an empty snippet:
									  `writeText('')` resolves, and the toast says "copied".
									*/
									<DropdownMenuItem
										key={candidate.id}
										disabled={!ready}
										onClick={() => copyView(candidate)}
									>
										<Copy />
										{candidate.copy}
									</DropdownMenuItem>
								))}
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				</div>

				{VIEWS.map((candidate) => (
					/*
					  `focus-visible:` because Radix gives every `TabsContent` a
					  `tabIndex={0}` and the primitive sets `outline-none`, so this is a
					  keyboard stop with nothing drawn on it.
					*/
					/*
					  `tabIndex={-1}` removes the stop Radix puts on every panel. The
					  `pre` below is focusable because it scrolls, and two consecutive
					  stops for one region - the first of which does nothing - is worse
					  than one that works.
					*/
					<TabsContent key={candidate.id} value={candidate.id} tabIndex={-1}>
						{/*
						  Empty rather than explained when there is no key. Whatever the
						  reason - no answer yet, a refused load, no keys at all, none
						  usable - the Access section directly above is already saying it,
						  and the sentence that stood here ("Select a key...") was an
						  instruction the user could not act on in three of those four
						  states.
						*/}
						{ready ? (
							<pre
								/*
								  Focusable, and with its scrollbar left on. The `src` line of
								  the HTML snippet is ~180 characters, about 1300px in a
								  ~350px box, and `no-scrollbar` removed both the persistent
								  bar and the overlay flash - so there was nothing at all to
								  say the content continued, and no way to reach it without a
								  mouse. `tabIndex` is what makes arrow keys scroll this
								  element rather than its nearest scrollable ancestor.
								*/
								tabIndex={0}
								/*
								  Named, because a focusable scrollable stop that announces
								  nothing on arrival has no purpose to a screen reader.
								  `group` rather than `region`, which would add a landmark
								  inside a dialog for a block its own tabpanel already names.
								  The ring is `ring-inset` because an outset one is clipped
								  away entirely by the frame's `overflow-hidden`, and full
								  opacity because `ring-ring/50` measured 1.3:1 against the
								  code behind it.
								*/
								role="group"
								aria-label={candidate.tab}
								className={cn(
									'ph-no-capture focus-visible:ring-ring max-h-64 overflow-y-auto p-3 font-mono text-xs focus-visible:ring-2 focus-visible:ring-inset',
									// A URL is one long unbroken token, so it wraps rather than
									// scrolling sideways off a 26rem panel; markup keeps its own
									// line breaks and scrolls.
									candidate.id === 'url'
										? 'break-all whitespace-pre-wrap'
										: 'overflow-x-auto'
								)}
							>
								<code>{code[candidate.id]}</code>
							</pre>
						) : (
							<div className="min-h-20" />
						)}
					</TabsContent>
				))}
			</div>
		</Tabs>
	)
}
