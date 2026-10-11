import { Button } from '@shared/components/ui/button'
import { formatFileSize } from '@shared/utils'
import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router'

import { CtaPanel } from './cta-panel'
import { ModelLinkRow } from './model-link-row'
import { CONVERT_INDEX_COPY } from '../../lib/convert/convert-pairs'
import {
	publisherSampleHref,
	requireSampleModel
} from '../../lib/samples/sample-models'

import type { ArticleCta, ArticleCtaShortcut } from '../../lib/news/article-cta'
import type { FC } from 'react'

interface Props {
	cta: ArticleCta
	/** Reports which action was taken: `primary`, or the id of the model opened. */
	onAction: (action: string) => void
	className?: string
}

/** The shortcut's link. The manifest has already rejected an unknown id. */
function shortcutLink({ id }: ArticleCtaShortcut) {
	const sample = requireSampleModel(id)
	return {
		to: publisherSampleHref(id),
		previewUrl: sample.previewUrl,
		title: `Or open the ${sample.label.toLowerCase()} sample`,
		meta: `${formatFileSize(sample.bytes)} · ${sample.hint}`
	}
}

/**
 * The article's last ask, and its only one.
 *
 * Sign-up and pricing are gone from here on purpose. The article has just
 * explained something the reader can try with no account, and the publisher
 * asks for one itself at the moment there is a scene worth saving.
 *
 * The model beside the button is a slim row rather than tiles: it is a
 * shortcut to the same place, and two large pictures read as a second ask.
 */
export const ArticleCtaPanel: FC<Props> = ({ cta, onAction, className }) => {
	if (cta.kind === 'convert') {
		return (
			<CtaPanel
				className={className}
				heading="Convert your own file"
				description={CONVERT_INDEX_COPY.description}
				actions={
					<Button asChild>
						<Link to={cta.to} onClick={() => onAction('primary')}>
							Open the converters
							<ArrowRight className="h-4 w-4" />
						</Link>
					</Button>
				}
			/>
		)
	}

	const shortcut = shortcutLink(cta.shortcut)

	return (
		<CtaPanel
			className={className}
			heading="Try it on a model"
			description="Drop your own model into the Publisher, or start from one of ours. No account needed."
			actions={
				<div className="flex flex-wrap items-center gap-x-4 gap-y-3">
					<Button asChild>
						<Link to="/publisher" onClick={() => onAction('primary')}>
							Open the Publisher
							<ArrowRight className="h-4 w-4" />
						</Link>
					</Button>
					<ModelLinkRow
						{...shortcut}
						surface="raised"
						onClick={() => onAction(cta.shortcut.id)}
					/>
				</div>
			}
		/>
	)
}
