import { useState } from 'react'
import { MemoryRouter } from 'react-router'

import { InlineEditableMetadataField } from './inline-editable-metadata-field'
import { ProjectCard } from './project-card'
import { SceneThumbnail } from './scene-thumbnail'
import { StatusBreakdown } from './status-breakdown'
import { UsageMeter, UsageMeterGrid } from './usage-meter'
import {
	STORAGE_USAGE_HINT,
	STORAGE_USAGE_LABEL
} from '../../constants/product-copy'

import type { Meta, StoryObj } from '@storybook/react-vite'

/**
 * The pieces the dashboard landing page and projects browse are built from.
 *
 * Rendered on a `ds-raised` panel rather than the page background: these all sit
 * inside panels in the real layout, and a surface that separates from a flat
 * background but not from a panel is the failure the elevation ladder exists to
 * catch.
 */
const meta = {
	title: 'Dashboard/Pieces',
	parameters: { layout: 'padded' }
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

const MB = 1024 * 1024

/**
 * The states that matter are the ends: unlimited (every paid plan has at least
 * one), and at/over a limit, which is where the meter has to actually say
 * something rather than decorate.
 */
export const UsageMeters: Story = {
	render: () => (
		<div className="ds-raised space-y-6 rounded-2xl p-6">
			<UsageMeterGrid>
				<UsageMeter label="Scenes" current={4} limit={10} />
				<UsageMeter label="Published" current={8} limit={10} />
				<UsageMeter label="Projects" current={1} limit={1} />
				<UsageMeter
					label={STORAGE_USAGE_LABEL}
					hint={STORAGE_USAGE_HINT}
					current={12}
					limit={null}
				/>
			</UsageMeterGrid>

			<div className="max-w-sm space-y-3">
				<UsageMeter
					variant="row"
					label="Scenes (total)"
					current={4}
					limit={10}
				/>
				<UsageMeter
					variant="row"
					label="API requests"
					current={9_400}
					limit={10_000}
					monthly
				/>
				<UsageMeter
					variant="row"
					label={STORAGE_USAGE_LABEL}
					hint={STORAGE_USAGE_HINT}
					current={480 * MB}
					limit={500 * MB}
					format={(value) => `${Math.round(value / MB)} MB`}
				/>
				<UsageMeter
					variant="row"
					label="Embed bandwidth"
					current={2}
					limit={null}
					monthly
				/>
			</div>
		</div>
	)
}

/**
 * A missing thumbnail is the normal case, not the exception - `thumbnailUrl` is
 * only written after a publisher save with a viewport capture. Both a null
 * source and a 404 resolve to the same neutral well, so there is one state to
 * diff rather than two.
 */
export const Thumbnails: Story = {
	render: () => (
		<div className="ds-raised grid grid-cols-2 gap-4 rounded-2xl p-6">
			<SceneThumbnail src={null} />
			<SceneThumbnail src="/does-not-exist.png" />
		</div>
	)
}

export const StatusBreakdowns: Story = {
	render: () => (
		<div className="ds-raised space-y-4 rounded-2xl p-6">
			<StatusBreakdown counts={{ published: 9, draft: 3, archived: 0 }} />
			<StatusBreakdown counts={{ published: 0, draft: 4, archived: 2 }} />
			<StatusBreakdown
				counts={{ published: 2, draft: 1, archived: 0 }}
				verbose
			/>
			<StatusBreakdown counts={{ published: 0, draft: 0, archived: 0 }} />
		</div>
	)
}

/**
 * The last card has no scenes: it must read "No scenes yet" rather than borrow
 * today's date, which is what the table did.
 */
export const ProjectCards: Story = {
	render: () => (
		<MemoryRouter>
			<div className="ds-raised grid gap-4 rounded-2xl p-6 md:grid-cols-3">
				<ProjectCard
					project={{
						id: '1',
						name: 'Studio Showcase',
						organizationName: 'Acme',
						counts: { published: 9, draft: 3, archived: 0 },
						thumbnailUrl: null,
						updatedAt: new Date()
					}}
				/>
				<ProjectCard
					project={{
						id: '2',
						name: 'Retail Configurator',
						organizationName: 'Acme',
						counts: { published: 1, draft: 3, archived: 2 },
						thumbnailUrl: null,
						updatedAt: new Date(Date.now() - 5 * 86_400_000)
					}}
				/>
				<ProjectCard
					project={{
						id: '3',
						name: 'Archive',
						organizationName: 'Acme',
						counts: { published: 0, draft: 0, archived: 0 },
						thumbnailUrl: null,
						updatedAt: null
					}}
				/>
			</div>
		</MemoryRouter>
	)
}

/**
 * The scene header's inline-editable title and description, in the panel they
 * actually live in.
 *
 * The radii were the problem: the panel is `rounded-2xl` (28px) with 16px of
 * padding, so a concentric inner corner is 12px - but both field states used the
 * Input/Textarea default of `rounded-xl` (20px), which curves faster than the box
 * around it. Rendered here inside the real `ds-raised rounded-2xl` panel so the
 * two arcs can be compared directly.
 */
export const InlineEditableFields: Story = {
	render: function InlineFieldsStory() {
		const [title, setTitle] = useState('Porsche GT3')
		const [description, setDescription] = useState('')

		return (
			<section className="ds-raised space-y-6 rounded-2xl px-4 py-4 sm:px-5">
				<div className="min-w-0 grow space-y-2">
					<InlineEditableMetadataField
						ariaLabel="Scene title"
						value={title}
						onChange={setTitle}
						onCommit={async () => {}}
						titleStyle="title"
						placeholder="Scene Title"
						isUnsaved
						isSaving={false}
						isSaved={false}
					/>
					<InlineEditableMetadataField
						ariaLabel="Scene description"
						multiline
						value={description}
						onChange={setDescription}
						onCommit={async () => {}}
						placeholder="Scene Description"
						isUnsaved={false}
						isSaving={false}
						isSaved={false}
					/>
				</div>
			</section>
		)
	}
}
