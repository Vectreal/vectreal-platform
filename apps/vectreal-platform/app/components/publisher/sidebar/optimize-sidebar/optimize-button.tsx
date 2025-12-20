import { Button } from '@shared/components/ui/button'
import { SparklesIcon } from 'lucide-react'

interface OptimizeButtonProps {
	onOptimize: () => Promise<void>
	isPending: boolean
	hasOptimized: boolean
}

export const OptimizeButton: React.FC<OptimizeButtonProps> = ({
	hasOptimized,
	isPending,
	onOptimize
}) => (
	<>
		<div className="h-9" />

		<div className="bg-muted/50 fixed bottom-0 left-0 z-10 flex w-full shadow-2xl backdrop-blur-xl">
			<Button
				variant="secondary"
				className="m-2 grow rounded-lg"
				onClick={onOptimize}
				disabled={isPending}
			>
				{isPending ? (
					<>
						<SparklesIcon className="mr-2 h-4 w-4 animate-spin" />
						Optimizing...
					</>
				) : (
					<>
						<SparklesIcon className="mr-2 h-4 w-4" />
						{hasOptimized ? 'Optimize More' : 'Apply Optimizations'}
					</>
				)}
			</Button>
		</div>
	</>
)
