import { createFileRoute } from '@tanstack/react-router'
import { SquareChevronLeftIcon, SquareChevronRightIcon } from 'lucide-react'
import { z } from 'zod'

import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { components } from '@/features/ui-demo/constants'

const componentsPerPage = 6

const SearchSchema = z.object({
  page: z.number().default(0).optional(),
})

export const Route = createFileRoute('/ui/')({
  component: RouteComponent,
  validateSearch: (search) => SearchSchema.parse(search),
})

function RouteComponent() {
  const { page = 0 } = Route.useSearch()
  const navigate = Route.useNavigate()
  const setPage = (value: number) =>
    navigate({ to: '.', search: { page: value } })

  const handleClickPrevious = () => {
    setPage(Math.max(page - 1, 0))
  }

  const handleClickNext = () => {
    setPage(
      Math.min(page + 1, Math.floor(components.length / componentsPerPage)),
    )
  }

  return (
    <div className="p-2 flex gap-2 flex-col bg-accent h-full overflow-auto">
      <div className="flex justify-between">
        <Button
          disabled={page === 0}
          onClick={handleClickPrevious}
          variant="outline"
          size="icon-lg"
        >
          <SquareChevronLeftIcon />
        </Button>
        <Button
          disabled={page === Math.floor(components.length / componentsPerPage)}
          onClick={handleClickNext}
          variant="outline"
          size="icon-lg"
        >
          <SquareChevronRightIcon />
        </Button>
      </div>
      <div className="flex gap-2 flex-wrap h-full overflow-auto">
        {components
          .filter((_, index) => {
            return (
              index >= page * componentsPerPage &&
              index < (page + 1) * componentsPerPage
            )
          })
          .map((component) => {
            return (
              <Content
                key={component}
                title={`${component}`}
                src={`#/ui/${component}?fullscreen=true`}
                to={`/ui/${component}`}
              />
            )
          })}
      </div>
    </div>
  )
}

function Content({
  title,
  src,
  to,
}: {
  title: string
  src: string
  to: string
}) {
  const navigate = Route.useNavigate()

  return (
    <Card className="h-max w-max">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <iframe
          src={src}
          width={600}
          height={400}
          className="border rounded-xl"
        />
      </CardContent>
      <CardFooter>
        <Button variant="link" onClick={() => navigate({ to })}>
          詳細
        </Button>
      </CardFooter>
    </Card>
  )
}
