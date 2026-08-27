import { Button } from '@shared/components/ui/button'
import { cn } from '@shared/utils'
import { ExternalLink } from 'lucide-react'
import { useEffect, useMemo, useState, type FC } from 'react'
import { Link } from 'react-router'

import { EmbedKeySelect } from './embed-key-select'
import { EmbedSnippetCard } from './embed-snippet-card'
import { useEmbedApiKeys } from './use-embed-api-keys'
import {
	buildEmbedUrl,
	buildResponsiveEmbedSnippet,
	buildSdkEmbedSnippet,
	EMBED_COPY,
	EMBED_DOCS_PATH
} from '../../lib/domain/embed/embed-snippet'
import { DetailPanelSection, InlineNotice } from '../layout-components'

/**
 * The house idiom for a link sitting on a section's heading row.
 *
 * A ghost button rather than `variant="link"`, which has no other call site in
 * the repo: the underlines were invented here, and then two of the variant's
 * own defaults were overridden to make them tolerable. `text-xs` and the muted
 * foreground keep it from competing with the `text-h4` title beside it.
 */
const HEADING_LINK_CLASS = 'text-muted-foreground hover:text-foreground text-xs'


interface EmbedOptionsPanelProps {
	sceneId?: string
	projectId?: string
	className?: string
}

/**
 * Everything needed to put a published scene on someone else's site.
 *
 * Two sections. Access is what makes the embed work - a key, and the domains
 * allowed to load it - and Embed Code is the one artifact you take away, in
 * whichever of three shapes you want it. There was a third, `Embed URL`, with
 * its own input and copy button; the URL is a view of the snippet, not a
 * separate parcel, so it is a tab now and "just the URL" is a menu item.
 *
 * `headingLevel="h4"` because that is the rung both hosts leave open. The
 * publisher nests the panel under an `AccordionTrigger`, which Radix renders
 * inside an `h3`. The dashboard drawer nests it under `h3 Publishing`, in a
 * wrapper left deliberately untitled so these land directly beneath it.
 *
 * No width or height fields. Both land in the snippet's inline `style`, which
 * is on screen and editable in the code being handed over, so a field would be
 * a second place to make the same edit.
 */
export const EmbedOptionsPanel: FC<EmbedOptionsPanelProps> = ({
	sceneId,
	projectId,
	className
}) => {
	// Read after mount rather than during render, because `window` is not a thing
	// a render may reach for. Not a hydration fix: neither host server-renders
	// this subtree - the drawer is behind a portal that renders nothing while
	// closed, and the publisher's Embed accordion has no `defaultValue`, so it is
	// collapsed and unmounted on first paint.
	const [origin, setOrigin] = useState('')
	useEffect(() => setOrigin(window.location.origin), [])

	const canEmbed = Boolean(sceneId && projectId)
	const keysApi = useEmbedApiKeys({ projectId, enabled: canEmbed })

	const embedUrl = useMemo(() => {
		if (!canEmbed || !origin || !keysApi.token) return ''

		return buildEmbedUrl({
			origin,
			projectId: projectId as string,
			sceneId: sceneId as string,
			token: keysApi.token
		})
	}, [canEmbed, origin, projectId, sceneId, keysApi.token])

	/*
	  A snippet without a key is not a partial snippet, it is a broken one:
	  `buildEmbedUrl` omits the parameter rather than failing, so the result
	  looks finished and 404s on every site. Nothing is offered to copy until
	  there is a key behind it.
	*/
	const ready = Boolean(embedUrl)

	const code = useMemo(
		() => ({
			html: embedUrl ? buildResponsiveEmbedSnippet({ src: embedUrl }) : '',
			sdk: embedUrl ? buildSdkEmbedSnippet({ src: embedUrl }) : '',
			url: embedUrl
		}),
		[embedUrl]
	)

	/*
	  `noopener` without `noreferrer`, deliberately. `noreferrer` strips the
	  `Referer` header, and `validatePreviewApiKeyForProject` then sees no
	  requester host at all: off a localhost-like instance that falls straight
	  through to `domain_not_allowed`, so the button meant to prove the embed
	  works would 403 on every production scene that is in fact fine.
	*/
	const openEmbedUrl = () => {
		if (!embedUrl) return
		window.open(embedUrl, '_blank', 'noopener')
	}

	if (!canEmbed) {
		return (
			<div className={cn('space-y-4', className)}>
				<InlineNotice>{EMBED_COPY.unavailableUntilSaved}</InlineNotice>
			</div>
		)
	}

	return (
		<div className={cn('space-y-4', className)}>
			<DetailPanelSection
				title={EMBED_COPY.accessTitle}
				headingLevel="h4"
				action={
					/*
					  The class goes on `Button`, not on the `Link`. Radix's `Slot` joins
					  the two className strings rather than merging them through `cn()`,
					  so `hover:text-foreground` on the child lost to ghost's own
					  `hover:text-foreground/90` on source order alone and never applied.
					*/
					<Button
						variant="ghost"
						size="sm"
						asChild
						className={HEADING_LINK_CLASS}
					>
						<Link
							to={`/dashboard/projects/${projectId}/edit`}
							target="_blank"
							rel="noreferrer"
						>
							{EMBED_COPY.editProject}
							<ExternalLink />
						</Link>
					</Button>
				}
			>
				<EmbedKeySelect api={keysApi} />

				{/*
				  The whole block waits for an answer rather than each statement in it
				  deciding for itself. Zero domains is what a project with none, a
				  request in flight, a request never dispatched (this panel is
				  server-rendered and the request goes out from an effect), and a
				  refused request all look like from here - so a notice swearing the
				  project refuses every third-party site is a false statement in three
				  of those four cases.

				  No heading and no caption. The chips name themselves, and the one
				  sentence that changes what someone does is the empty case.
				*/}
				{keysApi.hasAnswer &&
					(keysApi.allowedDomains.length === 0 ? (
						<InlineNotice>{EMBED_COPY.allowedDomainsEmpty}</InlineNotice>
					) : (
						<ul
							aria-label={EMBED_COPY.allowedDomainsLabel}
							className="flex flex-wrap gap-1"
						>
							{keysApi.allowedDomains.map((domain) => (
								/*
								  `min-w-0` and `break-all`, because a domain is the one
								  unbounded user string on this surface and a dot is not a
								  soft-wrap opportunity. `staging.customer-portal.example.co.uk`
								  is one unbreakable run wider than the 26rem panel, and the
								  two hosts failed differently: the publisher's
								  `AccordionContent` is `overflow-hidden`, so it was silently
								  clipped mid-string - the user could not read the value they
								  have to match - and the drawer body is `overflow-y-auto`,
								  which computes `overflow-x` to `auto` and gave the whole
								  drawer a horizontal scrollbar.

								  `publisher-shell-nested` rather than `ds-sunken`, for the
								  reason `EmbedSnippetCard` records: the `ds-*` ladder mixes
								  against `--background`, which is not what either host is.
								*/
								<li
									key={domain}
									className="publisher-shell-nested min-w-0 rounded-full px-2 py-0.5"
								>
									<code className="font-mono text-xs break-all">{domain}</code>
								</li>
							))}
						</ul>
					))}
			</DetailPanelSection>

			<DetailPanelSection
				title={EMBED_COPY.embedCodeLabel}
				headingLevel="h4"
				action={
					/*
					  `target="_blank"`, like the link above it. In the publisher this
					  panel sits inside an unsaved composition; navigating away from it
					  in the same tab loses that work.
					*/
					<Button
						variant="ghost"
						size="sm"
						asChild
						className={HEADING_LINK_CLASS}
					>
						<Link to={EMBED_DOCS_PATH} target="_blank" rel="noreferrer">
							{EMBED_COPY.docsLink}
							<ExternalLink />
						</Link>
					</Button>
				}
			>
				<EmbedSnippetCard code={code} ready={ready} onTest={openEmbedUrl} />
			</DetailPanelSection>
		</div>
	)
}
