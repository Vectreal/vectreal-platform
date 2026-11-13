import { Button } from '@shared/components/ui/button'
import { cn } from '@shared/utils'
import { Download, ImageUp } from 'lucide-react'
import { useState } from 'react'
import { data, Link } from 'react-router'

import { Route } from './+types/generations'
import {
	DetailPanelSection,
	EmptyState
} from '../../components/layout-components'
import { useImgTo3dJobPolling } from '../../hooks/use-img-to-3d-generation'
import { loadAuthenticatedUser } from '../../lib/domain/auth/auth-loader.server'
import { resolveImgTo3dAccess } from '../../lib/domain/img-to-3d/img-to-3d-access.server'
import {
	IMG_TO_3D_ERROR_COPY,
	imgTo3dVariantFileName,
	isTerminalImgTo3dStatus,
	type ImgTo3dListedBatch,
	type ImgTo3dListedVariant
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

type VariantState = Pick<ImgTo3dListedVariant, 'status' | 'progress' | 'error'>

function describeVariant(state: VariantState): string {
	switch (state.status) {
		case null:
			return 'Checking'
		case 'queued':
			return 'Queued'
		case 'processing':
			return state.progress === null
				? 'Generating'
				: `Generating, ${state.progress}%`
		case 'succeeded':
			return 'Ready'
		case 'failed':
			return IMG_TO_3D_ERROR_COPY[state.error ?? 'generation_failed']
	}
}

function BatchSection({
	batch,
	states
}: {
	batch: ImgTo3dListedBatch
	states: ReadonlyMap<string, VariantState>
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
					const state = states.get(variant.jobId) ?? variant
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
										? 'Expired: models are kept for 7 days'
										: describeVariant(state)}
								</p>
							</div>
							{!batch.expired && state.status === 'succeeded' && (
								<Button asChild variant="outline" size="sm">
									<a
										href={`/api/img-to-3d/generations/${encodeURIComponent(variant.jobId)}/artifact`}
										download={fileName}
										aria-label={`Download ${fileName}`}
									>
										<Download />
										Download GLB
									</a>
								</Button>
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
	/*
	  Polled updates over what the loader listed, per job. Tied to the list
	  they were polled for, so a revalidated list starts clean rather than
	  showing an older poll over a newer load.
	*/
	const [polled, setPolled] = useState<{
		readonly batches: readonly ImgTo3dListedBatch[]
		readonly states: ReadonlyMap<string, VariantState>
	}>(() => ({ batches, states: new Map() }))
	const states = polled.batches === batches ? polled.states : NO_STATES

	/*
	  A few at a time: when the runtime refuses for a while, every listed
	  variant is pending, and the page should not ask for all of them each
	  round. Unknown states go first, newest first within each group: one
	  answer usually settles them, while a variant still generating holds its
	  slot for minutes and would keep a finished one stuck on "Checking".
	*/
	const pending = batches
		.filter((batch) => !batch.expired)
		.flatMap((batch) =>
			batch.variants.map((variant) => ({
				jobId: variant.jobId,
				status: (states.get(variant.jobId) ?? variant).status
			}))
		)
	const pendingIds = [
		...pending.filter(({ status }) => status === null),
		...pending.filter(
			({ status }) => status !== null && !isTerminalImgTo3dStatus(status)
		)
	]
		.map(({ jobId }) => jobId)
		.slice(0, POLLED_AT_ONCE)

	useImgTo3dJobPolling(pendingIds, (updates) =>
		setPolled((current) => {
			const base = current.batches === batches ? current.states : NO_STATES
			const next = new Map(base)
			for (const batch of batches) {
				for (const variant of batch.variants) {
					const update = updates.get(variant.jobId)
					if (!update) continue
					next.set(variant.jobId, {
						...(base.get(variant.jobId) ?? variant),
						...update
					})
				}
			}
			return { batches, states: next }
		})
	)

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
				<BatchSection key={batch.batchId} batch={batch} states={states} />
			))}
		</div>
	)
}

const NO_STATES: ReadonlyMap<string, VariantState> = new Map()

/** Variants the page polls in one round; the rest wait their turn. */
const POLLED_AT_ONCE = 12
