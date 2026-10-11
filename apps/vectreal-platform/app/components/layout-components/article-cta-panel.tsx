import { Button } from '@shared/components/ui/button'
import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router'

import { CtaPanel } from './cta-panel'
import { SampleTiles } from './sample-tiles'
import { CONVERT_INDEX_COPY } from '../../lib/convert/convert-pairs'
import { publisherSampleHref } from '../../lib/samples/sample-models'

import type { ArticleCta } from '../../lib/news/article-cta'
import type { FC } from 'react'

interface Props {
	cta: ArticleCta
	/** Reports which action was taken: `primary`, or the id of the sample opened. */
	onAction: (action: string) => void
	className?: string
}

/**
 * The article's last ask, and its only one.
 *
 * Sign-up and pricing are gone from here on purpose. The article has just
 * explained something the reader can try with no account, and the publisher
 * asks for one itself at the moment there is a scene worth saving.
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

	return (
		<CtaPanel
			className={className}
			heading="Try it on a model"
			description="Drop your own model into the Publisher, or start from one of ours. No account needed."
			actions={
				<div className="flex w-full flex-col gap-8">
					<Button asChild className="self-start">
						<Link to={cta.to} onClick={() => onAction('primary')}>
							Open the Publisher
							<ArrowRight className="h-4 w-4" />
						</Link>
					</Button>
					<SampleTiles
						label="Or open a sample"
						hrefFor={publisherSampleHref}
						onOpen={onAction}
					/>
				</div>
			}
		/>
	)
}
