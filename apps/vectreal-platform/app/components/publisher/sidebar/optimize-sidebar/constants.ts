import { FileIcon, Settings2, Star } from 'lucide-react'

export const ACCORDION_ITEMS = [
	{
		value: 'stats',
		icon: null, // This one uses a custom header
		title: 'Stats'
	},
	{
		value: 'basic',
		icon: Star,
		title: 'Optimization',
		size: 14
	},
	{
		value: 'advanced',
		icon: Settings2,
		title: 'Advanced Optimization',
		size: 14
	},
	{
		value: 'details',
		icon: FileIcon,
		title: 'Scene Details',
		size: 14
	}
] as const

export type AccordionItemValue = (typeof ACCORDION_ITEMS)[number]['value']
