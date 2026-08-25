import { cn } from '@shared/utils'
import { ReactNode, memo } from 'react'

import { InfoTooltip } from '../../info-tooltip'
import { DetailPanelSection } from '../../layout-components'

/**
 * A section inside a publisher sidebar panel.
 *
 * The heading rung, the tooltip slot and the rule beneath them are
 * `DetailPanelSection`'s, shared with the dashboard's Scene Details drawer;
 * this is the publisher's name for it, kept because its call sites pass a
 * `tooltip` string rather than a node and expect the sidebar's wider
 * `space-y-4` rhythm.
 *
 * Usage:
 * <SidebarSection title="Camera Settings" tooltip="Configure camera properties">
 *   <SidebarSectionContent>
 *     ... content ...
 *   </SidebarSectionContent>
 * </SidebarSection>
 */

interface SidebarSectionProps {
	title?: string
	tooltip?: string
	children: ReactNode
	className?: string
}

export const SidebarSection = memo(
	({ title, tooltip, children, className = '' }: SidebarSectionProps) => (
		<DetailPanelSection
			title={title}
			action={title && tooltip ? <InfoTooltip content={tooltip} /> : undefined}
			divider={Boolean(title)}
			className={cn('space-y-4', className)}
			contentClassName="space-y-4"
		>
			{children}
		</DetailPanelSection>
	)
)

SidebarSection.displayName = 'SidebarSection'

/**
 * Content wrapper for SidebarSection children.
 * Provides consistent spacing between fields and groups.
 */

interface SidebarSectionContentProps {
	children: ReactNode
	className?: string
}

export const SidebarSectionContent = memo(
	({ children, className = '' }: SidebarSectionContentProps) => (
		<div className={cn('space-y-4', className)}>{children}</div>
	)
)

SidebarSectionContent.displayName = 'SidebarSectionContent'

/**
 * Layout wrapper for a single setting row.
 * Groups a label/control pair with consistent spacing.
 * Use when you have one control per row (e.g., a slider or input field).
 */

interface SettingRowProps {
	label?: string
	children: ReactNode
	className?: string
}

export const SettingRow = memo(
	({ label, children, className = '' }: SettingRowProps) => (
		<div className={cn('space-y-2', className)}>
			{label && (
				<label className="text-muted-foreground text-xs font-medium">
					{label}
				</label>
			)}
			{children}
		</div>
	)
)

SettingRow.displayName = 'SettingRow'

/**
 * Layout wrapper for preset/button groups.
 * Provides consistent spacing and label styling for toggle button groups.
 */

interface SettingGroupProps {
	label: string
	description?: string
	children: ReactNode
	className?: string
}

export const SettingGroup = memo(
	({ label, description, children, className = '' }: SettingGroupProps) => (
		<div className={cn('space-y-2', className)}>
			<div className="flex items-center justify-between gap-2">
				<label className="text-muted-foreground text-xs font-medium">
					{label}
				</label>
			</div>
			{description && (
				<p className="text-muted-foreground/75 text-xs">{description}</p>
			)}
			{children}
		</div>
	)
)

SettingGroup.displayName = 'SettingGroup'
