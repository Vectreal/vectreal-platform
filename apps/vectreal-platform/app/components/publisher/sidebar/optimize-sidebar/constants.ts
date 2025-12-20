import { FileIcon, Settings2, Star } from  from '@shared/ui'

export const ACCORDION_ITEMS = [
	{
		value:  from '@shared/ui',
		icon: null, // This one uses a custom header
		title: 'Stats'
	},
	{
		value:  from '@shared/ui',
		icon: Star,
		title: 'Optimization',
		size: 14
	},
	{
		value:  from '@shared/ui',
		icon: Settings2,
		title: 'Advanced Optimization',
		size: 14
	},
	{
		value:  from '@shared/ui',
		icon: FileIcon,
		title: 'Scene Details',
		size: 14
	}
] as const

export type AccordionItemValue = (typeof ACCORDION_ITEMS)[number][ from '@shared/ui']
