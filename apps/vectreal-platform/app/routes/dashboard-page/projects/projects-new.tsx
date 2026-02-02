import { Button } from '@shared/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router'

const ProjectsNewPage = () => {
	return (
		<div className="p-6">
			<div className="mb-6 flex items-center gap-4">
				<Link viewTransition to="/dashboard/projects/">
					<Button variant="outline" size="sm">
						<ArrowLeft className="mr-2 h-4 w-4" />
						Back to Projects
					</Button>
				</Link>
				<h1 className="text-primary text-3xl font-bold">
					Create a New Project
				</h1>
			</div>
			<div className="rounded-lg border bg-white p-6">
				<p className="text-primary/70">
					Project creation form will be implemented here.
				</p>
			</div>
		</div>
	)
}

export default ProjectsNewPage
