import { ShadowsProps } from '@vctrl/viewer'
import { Label } from '@vctrl-ui/ui/label'

import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from '@vctrl-ui/ui/select'

import { useAtom } from 'jotai'

import { InfoTooltip } from '../../../../../components/info-tooltip'
import { shadowsAtom } from '../../../../../lib/stores/publisher-config-store'

const ShadowSettingsPanel = () => {
	const [{ type }, setShadows] = useAtom(shadowsAtom)

	const handleTypeChange = (value: ShadowsProps['type']) => {
		// Update the shadow type in the atom store
		setShadows((prev) => ({
			...prev,
			type: value
		}))
	}

	return (
		<div className="space-y-4">
			<p className="px-2">
				Either select a preset or go to the advanced optimization options.
			</p>
			<small className="text-muted-foreground/75 mt-2 mb-6 block px-2">
				After configuring you need to apply the optimizations to see the
				changes.
			</small>

			<div className="bg-muted/50 space-y-4 rounded-xl p-4">
				<div className="flex items-center gap-2">
					<p className="text-lg font-medium">Environment</p>
					<InfoTooltip content="Controls scene lighting and background, affecting reflections and model appearance." />
				</div>

				<Label>Shadow Type</Label>
				<Select defaultValue={type} onValueChange={handleTypeChange}>
					<SelectTrigger className="w-full capitalize">
						<SelectValue placeholder="Select Shadow Type" />
					</SelectTrigger>

					<SelectContent>
						<SelectItem value="accumulative">Accumulative</SelectItem>
						<SelectItem value="soft">Soft</SelectItem>
					</SelectContent>
				</Select>
			</div>
		</div>
	)
}

export default ShadowSettingsPanel
