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
	/**
	 * A control belonging to the section as a whole, sitting on the heading row
	 * beside the tooltip: an Add button, the switch that turns the section off.
	 *
	 * It follows `tooltip` in needing a title, because a heading row that draws
	 * no heading has nowhere to put it.
	 */
	action?: ReactNode
	children: ReactNode
	className?: string
}

export const SidebarSection = memo(
	({
		title,
		tooltip,
		action,
		children,
		className = ''
	}: SidebarSectionProps) => (
		<DetailPanelSection
			title={title}
			action={
				title && (tooltip || action) ? (
					<div className="flex items-center gap-2">
						{tooltip && <InfoTooltip content={tooltip} />}
						{action}
					</div>
				) : undefined
			}
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

/** The one caption style in publisher panels: a group's or a view's sentence. */
export const PanelCaption = ({ children }: { children: ReactNode }) => (
	<p className="text-muted-foreground text-xs">{children}</p>
)

interface SettingGroupProps {
	label: string
	/** The id of the control the label names, when there is a single one. */
	htmlFor?: string
	description?: ReactNode
	/** The setting's current value, read out at the end of the label row. */
	value?: ReactNode
	/** A control for the group as a whole, at the end of the label row. */
	action?: ReactNode
	children: ReactNode
	className?: string
}

/** A labelled group of controls, with an optional caption, value and action. */
export const SettingGroup = memo(
	({
		label,
		htmlFor,
		description,
		value,
		action,
		children,
		className = ''
	}: SettingGroupProps) => (
		<div className={cn('space-y-2', className)}>
			<div className="flex items-center justify-between gap-2">
				<label
					htmlFor={htmlFor}
					className="text-muted-foreground text-xs font-medium"
				>
					{label}
				</label>
				{value !== undefined && (
					<span className="text-muted-foreground text-xs font-medium tabular-nums">
						{value}
					</span>
				)}
				{action}
			</div>
			{description && <PanelCaption>{description}</PanelCaption>}
			{children}
		</div>
	)
)

SettingGroup.displayName = 'SettingGroup'
