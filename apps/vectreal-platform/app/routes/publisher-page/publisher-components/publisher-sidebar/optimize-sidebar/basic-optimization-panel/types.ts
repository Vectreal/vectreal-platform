export type OptimizationPreset = 'low' | 'medium' | 'high';

export interface OptimizationPresetOption {
  id: OptimizationPreset;
  label: string;
  description: string;
  icon: string;
}

export interface OptimizationPresetSelectorProps {
  selectedPreset: OptimizationPreset;
  onSelectPreset: (preset: OptimizationPreset) => void;
  onApplyPreset: () => void;
  isApplying: boolean;
  isSuccess?: boolean;
}

export interface PresetOptionProps {
  preset: OptimizationPresetOption;
  isSelected: boolean;
  onSelect: () => void;
}