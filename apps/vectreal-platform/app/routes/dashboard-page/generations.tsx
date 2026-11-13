import { Button } from '@shared/components/ui/button'
import { cn } from '@shared/utils'
import { Download, ImageUp } from 'lucide-react'
import { data, Link } from 'react-router'

import { Route } from './+types/generations'
import {
	DetailPanelSection,
	EmptyState
} from '../../components/layout-components'
import { useImgTo3dBatchStates } from '../../hooks/use-img-to-3d-generation'
import { loadAuthenticatedUser } from '../../lib/domain/auth/auth-loader.server'
import { resolveImgTo3dAccess } from '../../lib/domain/img-to-3d/img-to-3d-access.server'
import {
	IMG_TO_3D_EXPIRED_COPY,
	describeImgTo3dVariant,
	imgTo3dOpenHref,
	imgTo3dVariantFileName,
	type ImgTo3dListedBatch,
	type ImgTo3dListedVariant,
	type ImgTo3dVariantState
} from '../../lib/domain/img-to-3d/img-to-3d-contract'
import { imgTo3dServerDeps } from '../../lib/domain/img-to-3d/img-to-3d-deps.server'
import { listImgTo3dGenerations } from '../../lib/domain/img-to-3d/img-to-3d-handlers'

/*
  Every image-to-3D batch in the caller's organization, so a generation can be
  found again after the publisher tab that started it is gone. Behind the same
  gate as the job routes: anyone it refuses gets a 404, as they do there.
*/

export async function loader({ request }: Route.LoaderArgs) {
	const { user } = await loadAuthenticatedUser(request)
	const access = await resolveImgTo3dAccess(user)
	if (!access) throw data('Not found', { status: 404 })

	return data({
		batches: await listImgTo3dGenerations(
			access.organizationId,
			imgTo3dServerDeps
		)
	})
}

export { DashboardErrorBoundary as ErrorBoundary } from '../../components/errors'

// A fixed zone, so the server's render and the browser's hydration agree.
const shortDate = new Intl.DateTimeFormat('en-US', {
	dateStyle: 'medium',
	timeZone: 'UTC'
})

function BatchSection({
	batch,
	stateOf
}: {
	batch: ImgTo3dListedBatch
	stateOf: (variant: ImgTo3dListedVariant) => ImgTo3dVariantState
}) {
	const title = batch.sourceName ?? 'Untitled photo'
	const created = shortDate.format(new Date(batch.createdAt))
	const kept = batch.expired
		? 'past its 7 days'
		: `kept until ${shortDate.format(new Date(batch.keptUntil))}`

	return (
		<DetailPanelSection
			surface="raised"
			headingLevel="h2"
			title={title}
			description={`${batch.createdByName ?? 'A former member'} · ${created} · ${kept}`}
		>
			<ul className="space-y-2">
				{batch.variants.map((variant) => {
					const state = stateOf(variant)
					const fileName = imgTo3dVariantFileName(
						batch.sourceName,
						variant.seed
					)
					return (
						<li
							key={variant.jobId}
							className="flex items-center justify-between gap-4"
						>
							<div className="min-w-0">
								<p className="text-sm font-medium">Seed {variant.seed}</p>
								<p
									className={cn(
										'text-sm',
										!batch.expired && state.status === 'failed'
											? 'text-destructive'
											: 'text-muted-foreground'
									)}
									aria-live="polite"
								>
									{batch.expired
										? IMG_TO_3D_EXPIRED_COPY
										: describeImgTo3dVariant(state)}
								</p>
							</div>
							{!batch.expired && state.status === 'succeeded' && (
								<div className="flex shrink-0 gap-2">
									<Button asChild variant="ghost" size="sm">
										<a
											href={`/api/img-to-3d/generations/${encodeURIComponent(variant.jobId)}/artifact`}
											download={fileName}
											aria-label={`Download ${fileName}`}
										>
											<Download />
											Download GLB
										</a>
									</Button>
									<Button asChild variant="outline" size="sm">
										<Link
											to={imgTo3dOpenHref(variant.jobId)}
											aria-label={`Open ${fileName} in the Publisher`}
										>
											Open in Publisher
										</Link>
									</Button>
								</div>
							)}
						</li>
					)
				})}
			</ul>
		</DetailPanelSection>
	)
}

export default function GenerationsPage({ loaderData }: Route.ComponentProps) {
	const { batches } = loaderData
	const stateOf = useImgTo3dBatchStates(batches)

	if (batches.length === 0) {
		return (
			<div className="py-6">
				<EmptyState
					icon={ImageUp}
					title="No generations yet"
					description="Generate a model from a photo on the Publisher's empty stage. Every batch shows up here with its variants, ready to download for 7 days."
					action={
						<Button asChild variant="secondary">
							<Link to="/publisher">Open the Publisher</Link>
						</Button>
					}
				/>
			</div>
		)
	}

	return (
		<div className="space-y-4 py-6">
			{batches.map((batch) => (
				<BatchSection key={batch.batchId} batch={batch} stateOf={stateOf} />
			))}
		</div>
	)
}
