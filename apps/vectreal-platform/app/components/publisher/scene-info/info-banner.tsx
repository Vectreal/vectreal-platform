import { formatFileSize } from '@shared/utils'

interface InfoBannerProps {
	sceneBytes?: number | null
}

const InfoBanner = ({ sceneBytes }: InfoBannerProps) => {
	return (
		<div className="bg-muted text-primary/80 fixed bottom-0 z-20 flex w-full gap-4 px-4 py-1 text-xs font-medium">
			<span className="font-light">Scene Size: </span>
			{formatFileSize(sceneBytes ?? 0)}
			{/* {latestSceneStats?. ?? '—'} */}
		</div>
	)
}

export default InfoBanner
