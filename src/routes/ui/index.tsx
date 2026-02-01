import { createFileRoute } from '@tanstack/react-router'

import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/ui/')({
  component: RouteComponent,
})

function RouteComponent() {
  const navigate = Route.useNavigate()

  return (
    <div className="p-2 flex gap-2 flex-wrap bg-accent h-full overflow-auto">
      <Card className="h-max w-max">
        <CardHeader>
          <CardTitle>Button</CardTitle>
        </CardHeader>
        <CardContent>
          <iframe
            src="#/ui/button?fullscreen=true"
            width={600}
            height={400}
            className="border rounded-xl"
          />
        </CardContent>
        <CardFooter>
          <Button variant="link" onClick={() => navigate({ to: '/ui/button' })}>
            詳細
          </Button>
        </CardFooter>
      </Card>

      <Card className="h-max w-max">
        <CardHeader>
          <CardTitle>Accordion</CardTitle>
        </CardHeader>
        <CardContent>
          <iframe
            src="#/ui/accordion?fullscreen=true"
            width={600}
            height={400}
            className="border rounded-xl"
          />
        </CardContent>
        <CardFooter>
          <Button
            variant="link"
            onClick={() => navigate({ to: '/ui/accordion' })}
          >
            詳細
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
