import { Separator } from '@shared/components/ui/separator'
import { ReactNode, memo } from 'react'

import { InfoTooltip } from '../../info-tooltip'

/**
 * Unified section header for sidebar panels.
 * Provides consistent visual hierarchy with:
 * - Clear, prominent section heading (text-sm font-semibold)
 * - Optional tooltip for context
 * - Separator line
 * - Proper spacing and breathing room
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
		<div className={`space-y-4 ${className}`}>
			{/* Section Header with Heading */}
			{title && (
				<>
					<div className="flex items-center justify-between gap-2">
						<h3 className="text-foreground! text-sm! font-semibold! tracking-tight!">
							{title}
						</h3>
						{tooltip && <InfoTooltip content={tooltip} />}
					</div>

					{/* Visual Separator */}
					<Separator />
				</>
			)}

			{/* Content */}
			{children}
		</div>
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
		<div className={`space-y-4 ${className}`}>{children}</div>
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
		<div className={`space-y-2 ${className}`}>
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
		<div className={`space-y-2 ${className}`}>
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
