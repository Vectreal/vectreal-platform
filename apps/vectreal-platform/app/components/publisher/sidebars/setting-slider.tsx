import { memo } from 'react'

import { SettingRow } from './sidebar-section'
import EnhancedSettingSlider from '../settings-components/enhanced-setting-slider'

import type { ComponentProps } from 'react'

/**
 * Enhanced slider wrapper that applies consistent typography and spacing.
 * Automatically applies SettingRow layout for proper visual hierarchy.
 *
 * Props are passed directly to EnhancedSettingSlider.
 */

type EnhancedSettingSliderProps = ComponentProps<typeof EnhancedSettingSlider>

interface SettingSliderProps extends Omit<EnhancedSettingSliderProps, 'label'> {
	label: string
	className?: string
}

export const SettingSlider = memo(
	({ label, className = '', ...sliderProps }: SettingSliderProps) => (
		<SettingRow label={label} className={className}>
			<EnhancedSettingSlider {...sliderProps} label={label} />
		</SettingRow>
	)
)

SettingSlider.displayName = 'SettingSlider'
