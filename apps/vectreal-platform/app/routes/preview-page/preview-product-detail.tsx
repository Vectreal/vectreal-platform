import { Badge } from '@shared/components/ui/badge'
import { Button } from '@shared/components/ui/button'
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle
} from '@shared/components/ui/card'
import { Separator } from '@shared/components/ui/separator'
import {
	ModelFile,
	SceneLoadResult,
	useLoadModel
} from '@vctrl/hooks/use-load-model'
import {
	InfoPopover,
	InfoPopoverCloseButton,
	InfoPopoverContent,
	InfoPopoverText,
	InfoPopoverTrigger,
	InfoPopoverVectrealFooter
} from '@vctrl/viewer'
import { memo, useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'

import { Route } from './+types/preview-product-detail'
import CenteredSpinner from '../../components/centered-spinner'
import { ClientVectrealViewer } from '../../components/viewer/client-vectreal-viewer'

interface PreviewModelProps {
	file: ModelFile | null
	sceneData?: SceneLoadResult
}

const PreviewInfoPopover = () => (
	<InfoPopover>
		<InfoPopoverTrigger />
		<InfoPopoverContent>
			<InfoPopoverCloseButton />
			<InfoPopoverText>
				<p>
					This is a preview of your scene as it will appear when published. Test
					on various devices and network conditions for the best experience.
				</p>
			</InfoPopoverText>
			<InfoPopoverVectrealFooter />
		</InfoPopoverContent>
	</InfoPopover>
)

const ProductDetailModel = memo(({ file, sceneData }: PreviewModelProps) => {
	return (
		<div className="bg-background relative h-[60vh] min-h-[420px] w-full overflow-hidden rounded-xl border md:h-[68vh]">
			<ClientVectrealViewer
				className="h-full w-full"
				model={file?.model}
				envOptions={sceneData?.environment}
				controlsOptions={sceneData?.controls}
				shadowsOptions={sceneData?.shadows}
				popover={<PreviewInfoPopover />}
				loader={<CenteredSpinner text="Preparing scene..." />}
				fallback={<CenteredSpinner text="Loading scene..." />}
			/>
		</div>
	)
})

const PreviewProductDetailPage = ({ params }: Route.ComponentProps) => {
	const [searchParams] = useSearchParams()
	const { file, loadFromServer } = useLoadModel()

	const [isLoadingScene, setIsLoadingScene] = useState(false)
	const [sceneData, setSceneData] = useState<SceneLoadResult>()

	const sceneId = params.sceneId
	const projectId = params.projectId

	const getSceneSettings = useCallback(async () => {
		if (!sceneId || !projectId) return

		setIsLoadingScene(true)

		const token = searchParams.get('token')?.trim() || undefined
		const endpointParams = new URLSearchParams({
			projectId,
			preview: '1'
		})

		if (token) {
			endpointParams.set('token', token)
		}

		try {
			const loadedSceneData = await loadFromServer({
				sceneId,
				serverOptions: {
					endpoint: `/api/scenes/${sceneId}?${endpointParams.toString()}`,
					apiKey: token
				}
			})

			setSceneData(loadedSceneData)
		} catch (error) {
			console.error('Failed to load preview scene:', error)
		} finally {
			setIsLoadingScene(false)
		}
	}, [loadFromServer, projectId, sceneId, searchParams])

	useEffect(() => {
		if (sceneId && projectId && !sceneData) {
			void getSceneSettings()
		}
	}, [getSceneSettings, projectId, sceneData, sceneId])

	if (isLoadingScene && !file?.model) {
		return <CenteredSpinner className="h-screen" text="Loading scene..." />
	}

	return (
		<div className="bg-background min-h-screen px-4 py-6 md:px-8 md:py-10">
			<div className="mx-auto flex w-full max-w-7xl flex-col items-center gap-8 md:flex-row">
				<section className="space-y-4">
					<div className="space-y-1">
						<p className="text-muted-foreground text-sm">
							Home / Placeholder / Product Name
						</p>
						<h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
							Placeholder Product Name
						</h1>
					</div>
					<ProductDetailModel file={file} sceneData={sceneData} />
					<p className="text-muted-foreground text-sm">
						This 3D preview is placed where a product image gallery usually
						appears, so you can visualize the viewer in a live shop layout.
					</p>
				</section>

				<Card className="h-fit">
					<CardHeader className="space-y-4">
						<div className="flex flex-wrap gap-2">
							<Badge>New arrival</Badge>
							<Badge variant="secondary">In stock</Badge>
						</div>
						<CardTitle className="text-2xl">Placeholder Product Name</CardTitle>
						<p className="text-muted-foreground text-sm">
							Lorem ipsum dolor sit amet consectetur adipisicing elit. Corrupti
							placeat porro saepe minima, dolor itaque inventore quod, fuga
							tenetur unde eaque expedita corporis rem ea et molestiae. Quas,
							natus blanditiis!.
						</p>
						<div className="flex items-end gap-3">
							<p className="text-3xl font-semibold">$129.00</p>
							<p className="text-muted-foreground text-sm line-through">
								$159.00
							</p>
						</div>
					</CardHeader>
					<CardContent className="space-y-5">
						<div className="space-y-2">
							<p className="text-sm font-medium">Color</p>
							<div className="flex flex-wrap gap-2">
								<Button type="button" variant="outline" size="sm">
									Matte Black
								</Button>
								<Button type="button" variant="outline" size="sm">
									Slate Gray
								</Button>
								<Button type="button" variant="outline" size="sm">
									Vibrant Orange
								</Button>
							</div>
						</div>

						<div className="space-y-2">
							<p className="text-sm font-medium">Size</p>
							<div className="flex flex-wrap gap-2">
								<Button type="button" variant="outline" size="sm">
									S
								</Button>
								<Button type="button" variant="outline" size="sm">
									M
								</Button>
								<Button type="button" variant="outline" size="sm">
									L
								</Button>
							</div>
						</div>

						<div className="grid gap-2 sm:grid-cols-2">
							<Button type="button">Add to cart</Button>
							<Button type="button" variant="outline">
								Buy now
							</Button>
						</div>

						<Separator />

						<ul className="text-muted-foreground space-y-2 text-sm">
							<li>Free shipping on orders over $80</li>
							<li>30-day returns</li>
							<li>2-year manufacturer warranty</li>
						</ul>
					</CardContent>
				</Card>
			</div>
		</div>
	)
}

export default PreviewProductDetailPage
