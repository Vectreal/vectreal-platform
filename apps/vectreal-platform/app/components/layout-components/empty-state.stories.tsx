import { Button } from '@shared/components/ui/button'
import { Bot, FolderPlus, Locate, Package, Plus, SearchX } from 'lucide-react'

import { EmptyState } from './empty-state'

import type { Meta, StoryObj } from '@storybook/react-vite'

/**
 * Every empty region in the app is one of these. `page` sits on the page and
 * draws its own panel; `inline` sits inside a panel, a table or the publisher
 * sidebar and recedes into it.
 */
const meta = {
	title: 'Layout/Empty state',
	component: EmptyState,
	parameters: { layout: 'padded' }
} satisfies Meta<typeof EmptyState>

export default meta
type Story = StoryObj<typeof meta>

export const Page: Story = {
	args: {
		icon: FolderPlus,
		title: 'Create your first project',
		description:
			'A project holds your scenes and the folders that organize them.',
		action: (
			<Button>
				<Plus aria-hidden />
				Create project
			</Button>
		)
	}
}

export const PageWithoutAction: Story = {
	args: {
		icon: Bot,
		title: 'Connect your first agent',
		description:
			'Sign in to Vectreal from a CLI or an AI agent and approve it. It shows up here with what it may do, and you can revoke it at any time.'
	}
}

export const FilteredOut: Story = {
	args: {
		icon: SearchX,
		title: 'No projects match these filters',
		description: 'Try a different search term, or clear the filters.',
		action: <Button variant="secondary">Clear filters</Button>
	}
}

/** Inside a raised panel, where it should read as a well, not a second card. */
export const InlineInPanel: Story = {
	args: { icon: Package, title: 'No linked assets', size: 'inline' },
	decorators: [
		(Story) => (
			<div className="ds-raised max-w-md rounded-2xl p-5">
				<Story />
			</div>
		)
	]
}

/** The publisher sidebar, which uses the shell recipe instead of the ladder. */
export const InlineInShell: Story = {
	args: {
		icon: Locate,
		title: 'Call out a point on the model',
		description: 'Add a marker, then click the model to place it.',
		size: 'inline',
		surface: 'shell',
		action: (
			<Button variant="outline" size="sm" className="gap-1.5">
				<Plus aria-hidden className="size-3.5" />
				Add marker
			</Button>
		)
	},
	decorators: [
		(Story) => (
			<div className="shell-panel max-w-xs rounded-2xl p-3">
				<Story />
			</div>
		)
	]
}
