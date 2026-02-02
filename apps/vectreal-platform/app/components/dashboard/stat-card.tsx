import { LucideIcon } from 'lucide-react'

interface StatCardProps {
	icon: LucideIcon
	value: number | string
	label: string
}

const StatCard = ({ icon: Icon, value, label }: StatCardProps) => {
	return (
		<div className="flex flex-col">
			<div className="flex items-center gap-2">
				<Icon className="text-primary h-6 w-6 shrink-0 sm:h-8 sm:w-8" />
				<div className="text-primary text-2xl font-bold">{value}</div>
			</div>

			<div className="text-muted-foreground text-sm">{label}</div>
		</div>
	)
}

export default StatCard
