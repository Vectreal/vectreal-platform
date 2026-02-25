import { Badge } from '@shared/components/ui/badge'
import { Button } from '@shared/components/ui/button'
import { CardContent, CardTitle } from '@shared/components/ui/card'
import { Star } from 'lucide-react'

import ProductScene from './product-scene'
import { BasicCard } from '../../components'


const MockShopSection = () => {
	return (
		<section className="relative min-h-[600px] w-full space-y-4 md:h-[80vh]">
			<div className="from-background to-background/0 absolute top-0 right-0 left-0 z-10 bg-gradient-to-b py-16">
				<span className="mx-auto block max-w-7xl px-4">
					<h2>Real Store, Real Product, Real Impact</h2>
					<p className="text-foreground/90 mt-4 text-lg md:text-xl">
						See how Vectreal could power your e-commerce experiences
					</p>
				</span>
			</div>

			<div className="grid h-full w-full grid-rows-2 md:absolute md:inset-0 md:flex">
				<div className="relative w-full max-md:h-150">
					<ProductScene />

					<div className="from-background to-background/0 absolute bottom-0 left-0 z-10 flex w-full justify-end bg-gradient-to-t p-4 pt-24">
						<div className="bg-muted/25 overflow-hidden rounded-lg p-2 text-sm backdrop-blur-sm">
							<Badge variant="secondary" className="mr-2">
								3D View
							</Badge>
							Drag to rotate • Pinch to zoom
						</div>
					</div>
				</div>

				<BasicCard className="mx-4 flex max-w-md md:absolute md:top-1/2 md:right-0 md:mx-4 md:-translate-y-1/2">
					<CardContent className="space-y-4">
						<div className="flex items-center gap-2">
							<Badge>Limited Edition</Badge>
							<div className="flex">
								{[1, 2, 3, 4, 5].map((star) => (
									<Star
										key={star}
										xmlns="http://www.w3.org/2000/svg"
										width="16"
										height="16"
										viewBox="0 0 24 24"
										fill={star <= 4 ? 'currentColor' : 'none'}
										stroke="currentColor"
										className={
											star <= 4 ? 'text-yellow-500' : 'text-priamary/30'
										}
									/>
								))}
							</div>
						</div>
						<h3 className="text-3xl font-medium">
							Alpine X3 Pro Mountain Bike
						</h3>

						<p className="mt-2 text-lg font-[300]!">$1,299.99</p>

						<p className="text-primary/70 flex-1">
							Lorem ipsum, dolor sit amet consectetur adipisicing elit.
							Distinctio blanditiis eum ipsam sit ipsum quod et excepturi.
						</p>

						<div className="space-y-4">
							{/* <div>
							<label className="block text-sm font-medium mb-1">Color</label>
							<div className="flex gap-3">
								{[
									{ name: 'Carbon Black', color: 'bg-black' },
									{ name: 'Alpine Blue', color: 'bg-blue-600' },
									{ name: 'Fire Red', color: 'bg-red-600' }
								].map((option) => (
									<div
										key={option.name}
										className={`w-8 h-8 rounded-full ${option.color}  ${option.name === 'Alpine Blue' ? 'ring-2 ring-offset-2 ring-blue-600' : ''}`}
										title={option.name}
									/>
								))}
							</div>
						</div> */}

							<div className="mt-6 flex flex-col gap-2">
								<label className="mb-1 block text-sm font-medium">
									Quantity
								</label>
								<div className="flex gap-2">
									<div className="bg-muted flex h-10 w-24 items-center justify-center rounded-lg">
										1
									</div>
									<Button disabled className="h-10 flex-1">
										Add to Cart
									</Button>
								</div>
							</div>
						</div>

						<div className="space-y-2">
							<CardTitle>Product Specifications</CardTitle>
							{/* <CardDescription>(High performance Kit)</CardDescription> */}
						</div>

						<dl className="text-muted-foreground grid grid-cols-1 gap-2 text-sm">
							<div className="grid grid-cols-2">
								<dt className="font-medium">Frame</dt>
								<dd>Carbon Fiber Composite</dd>
							</div>
							<div className="grid grid-cols-2">
								<dt className="font-medium">Suspension</dt>
								<dd>Full suspension, 140mm travel</dd>
							</div>
							<div className="grid grid-cols-2">
								<dt className="font-medium">Weight</dt>
								<dd>12.4 kg (27.3 lbs)</dd>
							</div>
							<div className="grid grid-cols-2">
								<dt className="font-medium">Drivetrain</dt>
								<dd>SRAM GX Eagle 12-speed</dd>
							</div>
						</dl>
					</CardContent>
				</BasicCard>
			</div>

			<div className="z-10 p-4 text-center md:absolute md:-bottom-8 md:left-1/2 md:-translate-x-1/2">
				<p className="text-muted-foreground/75! text-sm">
					A showcases how Vectreal enables interactive 3D product visualization
					for e-commerce
				</p>
				{/* <Button variant="outline" className="mt-4">
					See more examples
				</Button> */}
			</div>
		</section>
	)
}

export default MockShopSection
