import { Badge } from '@shared/components/ui/badge'
import { Button } from '@shared/components/ui/button'
import { Input } from '@shared/components/ui/input'
import { Inbox } from 'lucide-react'
import { useState } from 'react'
import { data, useFetcher } from 'react-router'
import {
	AuthenticityTokenInput,
	useAuthenticityToken
} from 'remix-utils/csrf/react'

import { Route } from './+types/intake'
import {
	DetailPanelSection,
	EmptyState
} from '../../components/layout-components'
import { ConfirmDestructiveDialog } from '../../components/shared/confirm-destructive-dialog'
import { MODEL_INTAKE_COPY } from '../../constants/product-copy'
import { requireIntakeAdmin } from '../../lib/domain/model-intake/model-intake-admin.server'
import { deleteIntakeById } from '../../lib/domain/model-intake/model-intake-deletion.server'
import {
	finishIntakeCleanup,
	listIntakeSubmissions,
	markIntakeDelivered,
	markIntakePilotBooked,
	setIntakeCleanupLog,
	startIntakeCleanup
} from '../../lib/domain/model-intake/model-intake-repository.server'
import {
	isIntakeProductType,
	MODEL_INTAKE_OUTCOMES,
	type ModelIntakeOutcome,
	type ModelIntakeStatus
} from '../../lib/domain/model-intake/model-intake-shared'
import {
	MODEL_INTAKE_PAGE_LINK_SECONDS,
	signIntakePhotoUrls
} from '../../lib/domain/model-intake/model-intake-storage.server'
import { ensureValidCsrfFormData } from '../../lib/http/csrf.server'

import type { DashboardConfirmationPlan } from '../../lib/domain/dashboard/dashboard-confirmation'

/*
  The free-model requests, for the team making the models. Internal: behind
  the `model-intake-admin` flag, English only, and it never shows the brand's
  name, email, company or message, which stay encrypted. The notification
  email carried those to the inbox; this page carries the work: photos, the
  cleanup clock, the outcome and the retention date.
*/

export async function loader({ request }: Route.LoaderArgs) {
	await requireIntakeAdmin(request)
	const rows = await listIntakeSubmissions()
	const requests = await Promise.all(
		rows.map(async (row) => ({
			...row,
			photoUrls: await signIntakePhotoUrls(
				row.photoPaths,
				MODEL_INTAKE_PAGE_LINK_SECONDS
			).catch(() => [])
		}))
	)
	const perBatch = new Map<string, number>()
	for (const row of rows) {
		perBatch.set(row.batch, (perBatch.get(row.batch) ?? 0) + 1)
	}
	return data({ requests, perBatch: [...perBatch.entries()] })
}

type IntakeActionResult = { ok: true } | { error: string }

export async function action({ request }: Route.ActionArgs) {
	// The gate first, so anyone it refuses gets the same 404 as the loader
	// rather than a CSRF 403 that confirms the page exists.
	await requireIntakeAdmin(request)
	const formData = await request.formData()
	const csrfCheck = await ensureValidCsrfFormData(request, formData)
	if (csrfCheck) return csrfCheck

	const id = formData.get('id')
	if (typeof id !== 'string' || id === '') {
		return data<IntakeActionResult>(
			{ error: 'No request named.' },
			{ status: 400 }
		)
	}

	const now = new Date()
	const intent = formData.get('intent')
	let found: boolean | 'not_started'
	switch (intent) {
		case 'start-cleanup':
			found = await startIntakeCleanup(id, now)
			break
		case 'stop-cleanup':
			found = await finishIntakeCleanup(id, now)
			break
		case 'log': {
			const rawMinutes = String(formData.get('cleanupMinutes') ?? '').trim()
			const minutes = rawMinutes === '' ? null : Number(rawMinutes)
			const rawOutcome = formData.get('outcome')
			const outcome = MODEL_INTAKE_OUTCOMES.includes(
				rawOutcome as ModelIntakeOutcome
			)
				? (rawOutcome as ModelIntakeOutcome)
				: null
			if (minutes !== null && (!Number.isInteger(minutes) || minutes < 0)) {
				return data<IntakeActionResult>(
					{ error: 'Minutes must be a whole number.' },
					{ status: 400 }
				)
			}
			found = await setIntakeCleanupLog(id, {
				cleanupMinutes: minutes,
				outcome
			})
			break
		}
		case 'delivered':
			found = await markIntakeDelivered(id, now)
			break
		case 'pilot-booked':
			found = await markIntakePilotBooked(id)
			break
		case 'delete':
			found = await deleteIntakeById(id)
			break
		default:
			return data<IntakeActionResult>(
				{ error: 'Unknown action.' },
				{ status: 400 }
			)
	}

	if (found === 'not_started') {
		return data<IntakeActionResult>(
			{ error: 'Start cleanup first.' },
			{ status: 409 }
		)
	}
	return found
		? data<IntakeActionResult>({ ok: true })
		: data<IntakeActionResult>({ error: 'Request not found.' }, { status: 404 })
}

export { DashboardErrorBoundary as ErrorBoundary } from '../../components/errors'

const STATUS_LABEL: Record<ModelIntakeStatus, string> = {
	received: 'New',
	in_cleanup: 'In cleanup',
	delivered: 'Delivered',
	pilot_booked: 'Pilot booked'
}

// A fixed zone, so the server's render and the browser's hydration agree.
const dateTime = new Intl.DateTimeFormat('en-GB', {
	dateStyle: 'medium',
	timeStyle: 'short',
	timeZone: 'Europe/Berlin'
})
const dateOnly = new Intl.DateTimeFormat('en-GB', {
	dateStyle: 'medium',
	timeZone: 'Europe/Berlin'
})

type IntakeRequest = Route.ComponentProps['loaderData']['requests'][number]

function describeSize(row: IntakeRequest): string {
	const parts = [row.heightCm, row.widthCm, row.depthCm]
	return parts.every((part) => part === null)
		? 'No size'
		: parts.map((part) => (part === null ? '?' : `${part}`)).join(' x ') + ' cm'
}

function IntakeActionButton({
	id,
	intent,
	label,
	variant = 'outline'
}: {
	id: string
	intent: string
	label: string
	variant?: 'outline' | 'default'
}) {
	const fetcher = useFetcher<IntakeActionResult>()
	return (
		<fetcher.Form method="post" className="flex items-center gap-2">
			<AuthenticityTokenInput />
			<input type="hidden" name="id" value={id} />
			<input type="hidden" name="intent" value={intent} />
			<Button
				type="submit"
				size="sm"
				variant={variant}
				disabled={fetcher.state !== 'idle'}
			>
				{label}
			</Button>
			{fetcher.data && 'error' in fetcher.data ? (
				<span role="alert" className="text-destructive text-body-sm">
					{fetcher.data.error}
				</span>
			) : null}
		</fetcher.Form>
	)
}

function IntakeRow({ row }: { row: IntakeRequest }) {
	const logFetcher = useFetcher<IntakeActionResult>()
	const deleteFetcher = useFetcher<IntakeActionResult>()
	const csrfToken = useAuthenticityToken()
	const [confirmDelete, setConfirmDelete] = useState(false)
	const productType = isIntakeProductType(row.productType)
		? MODEL_INTAKE_COPY.en.fields.productType.options[row.productType]
		: row.productType

	const deletePlan: DashboardConfirmationPlan = {
		tier: 'acknowledge',
		title: `Delete ${row.referenceCode}?`,
		description: 'The request and its three photos are removed now.',
		consequences: ['This cannot be undone'],
		confirmLabel: 'Delete request',
		token: null
	}

	return (
		<li className="ds-raised space-y-4 rounded-2xl p-5">
			<div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
				<span className="text-body font-medium">{row.referenceCode}</span>
				<Badge variant="secondary">{STATUS_LABEL[row.status]}</Badge>
				{row.productType === 'other' ? <Badge>Review first</Badge> : null}
				{row.emailStatus !== 'sent' ? (
					<Badge variant="destructive">Email {row.emailStatus}</Badge>
				) : null}
			</div>
			<p className="text-muted-foreground text-body-sm">
				{productType} · {describeSize(row)} · batch {row.batch} · {row.locale} ·
				received {dateTime.format(new Date(row.createdAt))}
			</p>

			<div className="flex flex-wrap gap-3">
				{row.photoUrls.map((url, index) => (
					<a
						key={url || index}
						href={url}
						target="_blank"
						rel="noreferrer"
						className="text-body-sm underline underline-offset-4"
					>
						Photo {index + 1}
					</a>
				))}
			</div>

			<div className="flex flex-wrap items-center gap-2">
				<IntakeActionButton
					id={row.id}
					intent="start-cleanup"
					label="Start cleanup"
				/>
				<IntakeActionButton
					id={row.id}
					intent="stop-cleanup"
					label="Stop cleanup"
				/>
				<span className="text-muted-foreground text-body-sm">
					{row.cleanupStartedAt
						? `Started ${dateTime.format(new Date(row.cleanupStartedAt))}`
						: 'Not started'}
					{row.cleanupFinishedAt
						? `, stopped ${dateTime.format(new Date(row.cleanupFinishedAt))}`
						: ''}
				</span>
			</div>

			<logFetcher.Form method="post" className="flex flex-wrap items-end gap-3">
				<AuthenticityTokenInput />
				<input type="hidden" name="id" value={row.id} />
				<input type="hidden" name="intent" value="log" />
				<label className="space-y-1.5">
					<span className="text-label-xs block">Cleanup minutes</span>
					<Input
						name="cleanupMinutes"
						inputMode="numeric"
						defaultValue={row.cleanupMinutes ?? ''}
						key={row.cleanupMinutes ?? 'none'}
						className="w-28"
					/>
				</label>
				<label className="space-y-1.5">
					<span className="text-label-xs block">Outcome</span>
					<select
						name="outcome"
						defaultValue={row.outcome ?? ''}
						key={row.outcome ?? 'none'}
						className="ds-field text-body-sm h-9 rounded-md px-3"
					>
						<option value="">Not judged</option>
						<option value="usable">Usable</option>
						<option value="unusable">Not usable</option>
					</select>
				</label>
				<Button type="submit" size="sm" disabled={logFetcher.state !== 'idle'}>
					Save
				</Button>
				{logFetcher.data && 'error' in logFetcher.data ? (
					<span className="text-destructive text-body-sm">
						{logFetcher.data.error}
					</span>
				) : null}
			</logFetcher.Form>

			<div className="flex flex-wrap items-center gap-2">
				<IntakeActionButton
					id={row.id}
					intent="delivered"
					label="Mark delivered"
				/>
				<IntakeActionButton
					id={row.id}
					intent="pilot-booked"
					label="Mark pilot booked"
				/>
				<Button
					type="button"
					size="sm"
					variant="destructive"
					onClick={() => setConfirmDelete(true)}
				>
					Delete now
				</Button>
				<span className="text-muted-foreground text-body-sm">
					{row.deleteAfter
						? `Deleted after ${dateOnly.format(new Date(row.deleteAfter))}`
						: 'Kept: the pilot agreement governs'}
				</span>
			</div>

			<ConfirmDestructiveDialog
				open={confirmDelete}
				onOpenChange={setConfirmDelete}
				plan={deletePlan}
				isPending={deleteFetcher.state !== 'idle'}
				errorMessage={
					deleteFetcher.data && 'error' in deleteFetcher.data
						? deleteFetcher.data.error
						: null
				}
				onConfirm={() =>
					deleteFetcher.submit(
						{ id: row.id, intent: 'delete', csrf: csrfToken },
						{ method: 'post' }
					)
				}
			/>
		</li>
	)
}

export default function IntakePage({ loaderData }: Route.ComponentProps) {
	const { requests, perBatch } = loaderData

	return (
		<div className="space-y-6">
			<DetailPanelSection title="Free-model requests">
				<p className="text-muted-foreground text-body-sm">
					{perBatch.length > 0
						? perBatch.map(([batch, count]) => `${batch}: ${count}`).join(' · ')
						: 'No requests yet.'}
				</p>
			</DetailPanelSection>
			{requests.length === 0 ? (
				<EmptyState
					icon={Inbox}
					title="No requests yet"
					description="Requests sent through /free-model appear here."
				/>
			) : (
				<ul className="space-y-4">
					{requests.map((row) => (
						<IntakeRow key={row.id} row={row} />
					))}
				</ul>
			)}
		</div>
	)
}
