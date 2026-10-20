import { ClaudeLogo } from '@shared/components/assets/icons/claude-logo'
import { CursorLogo } from '@shared/components/assets/icons/cursor-logo'
import { OpenaiLogo } from '@shared/components/assets/icons/openai-logo'
import { Button } from '@shared/components/ui/button'
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger
} from '@shared/components/ui/tooltip'
import { cn } from '@shared/utils'
import { Check, FileText, SquareTerminal } from 'lucide-react'
import { useLocation } from 'react-router'

import { useClipboardCopy } from '../../hooks/use-clipboard-copy'
import { useConsentedCapture } from '../../hooks/use-consented-capture'
import {
	AI_HANDOFF_TARGETS,
	buildPagePrompt,
	type AiHandoffKind,
	type AiHandoffTarget
} from '../../lib/ai-handoff/ai-handoff-targets'
import { getDocPage } from '../../lib/docs/docs-manifest'
import { fetchMarkdownTwin } from '../../lib/markdown/markdown-twin'

import type { FC, ReactNode } from 'react'

/*
  Claude Code takes a terminal rather than a second Claude mark: two identical
  icons a few pixels apart read as one target drawn twice.
*/
const TARGET_ICONS: Record<
	AiHandoffTarget['id'],
	FC<{ className?: string }>
> = {
	chatgpt: OpenaiLogo,
	claude: ClaudeLogo,
	cursor: CursorLogo,
	'claude-code': SquareTerminal
}

/*
  Important, because docs prose colours every bare `a` orange from a CSS module
  selector that outranks a utility, and the row also renders inside the prose.
*/
const ICON_BUTTON =
	'text-muted-foreground! hover:text-foreground! size-8 opacity-100! no-underline!'

const IconAction: FC<{ label: string; children: ReactNode }> = ({
	label,
	children
}) => (
	<Tooltip>
		<TooltipTrigger asChild>{children}</TooltipTrigger>
		<TooltipContent side="bottom">{label}</TooltipContent>
	</Tooltip>
)

export interface AiHandoffMenuProps {
	/** Analytics surface: where on the site the row sits. */
	surface: string
	/** The copy action's name, shown as its tooltip and accessible name. */
	copyLabel: string
	/** What the copy action looks like: a page by default, a prompt otherwise. */
	copyIcon?: FC<{ className?: string }>
	/** What it copies. Called only once the clipboard is known to exist. */
	copyValue: () => string | Promise<string>
	copyMessages: { success: string; failure: string; unavailable: string }
	/** The prompt each target opens with, by the kind of tool it is. */
	prompt: (kind: AiHandoffKind) => string
	className?: string
}

/**
 * One quiet line: "Ask AI", then a copy action and a link per chat or coding
 * agent. Icon buttons with tooltips rather than a menu, so the targets are in
 * view without a sentence explaining that they exist.
 */
export const AiHandoffMenu: FC<AiHandoffMenuProps> = ({
	surface,
	copyLabel,
	copyIcon: CopyIcon = FileText,
	copyValue,
	copyMessages,
	prompt,
	className
}) => {
	const clipboard = useClipboardCopy()
	const capture = useConsentedCapture()

	return (
		<div className={cn('flex items-center gap-0.5', className)}>
			<span className="text-muted-foreground text-body-sm mr-1.5">Ask AI</span>
			<IconAction label={copyLabel}>
				<Button
					variant="ghost"
					size="icon"
					className={ICON_BUTTON}
					aria-label={copyLabel}
					onClick={() => {
						capture('ai_handoff_clicked', { surface, target: 'copy' })
						void clipboard.copy('copy', copyValue, copyMessages)
					}}
				>
					{clipboard.copiedId === 'copy' ? <Check /> : <CopyIcon />}
				</Button>
			</IconAction>
			{AI_HANDOFF_TARGETS.map((target) => {
				const Icon = TARGET_ICONS[target.id]
				const label = `Open in ${target.label}`
				return (
					<IconAction key={target.id} label={label}>
						<Button variant="ghost" size="icon" className={ICON_BUTTON} asChild>
							<a
								href={target.buildUrl(prompt(target.kind))}
								target="_blank"
								rel="noreferrer"
								aria-label={label}
								onClick={() =>
									capture('ai_handoff_clicked', { surface, target: target.id })
								}
							>
								<Icon className="size-4" />
							</a>
						</Button>
					</IconAction>
				)
			})}
		</div>
	)
}

/** The row for a docs page or article: copies its markdown twin. */
export const PageHandoffMenu: FC<{
	surface: 'docs' | 'newsroom'
	htmlPath: string
	title: string
	className?: string
}> = ({ surface, htmlPath, title, className }) => (
	<AiHandoffMenu
		surface={surface}
		copyLabel="Copy page as Markdown"
		copyValue={() => fetchMarkdownTwin(htmlPath)}
		copyMessages={{
			success: 'Page copied as Markdown',
			failure: 'Could not copy the page. Try again in a moment.',
			unavailable: 'This browser does not allow copying here.'
		}}
		prompt={(kind) => buildPagePrompt(kind, htmlPath, title)}
		className={className}
	/>
)

/**
 * The docs page's row inside its content, at the end of the page's head
 * (`remark-doc-page-actions.ts` puts it there). Below `xl` only: from `xl` the
 * contents rail beside the article carries it instead.
 */
export const DocPageActions: FC = () => {
	const slug = useLocation()
		.pathname.replace(/^\/docs\/?/, '')
		.replace(/\/$/, '')
	const page = getDocPage(slug)
	if (!page) return null

	return (
		<PageHandoffMenu
			surface="docs"
			htmlPath={`/docs/${page.slug}`}
			title={page.title}
			// The last row of the page's head, under its introduction; from `xl` the contents rail holds it.
			className="pt-2 xl:hidden"
		/>
	)
}
