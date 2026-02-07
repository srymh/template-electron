import * as React from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { z } from 'zod'

import { MoonIcon, SunIcon } from 'lucide-react'
import type { Theme } from '#/main/api/theme'
import type { Style } from '@/features/style/components/style-provider'
import { useTheme } from '@/components/theme-provider'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import { getPaginationItems } from '@/lib/pagination'
import { useStyle } from '@/features/style/api/useStyle'
import { STYLES } from '@/features/style/components/style-provider'
import { components } from '@/features/ui-demo/constants'
import { useIframeMessage } from '@/hooks/use-iframe-message'
import { formatKebabAsTitle } from '@/lib/format-kebab-as-title'
import { ThemeSwitcher } from '@/components/theme-switcher'
import { StyleSwitcher } from '@/features/style/components/style-switcher'
import { cn } from '@/lib/utils'
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card'

const SearchSchema = z.object({
  page: z.number().default(0).optional(),
})

export const Route = createFileRoute('/ui/')({
  component: RouteComponent,
  validateSearch: (search) => SearchSchema.parse(search),
})

function RouteComponent() {
  const componentsPerPage = 3
  const { page: rawPage = 0 } = Route.useSearch()
  const navigate = Route.useNavigate()

  const totalPages = Math.ceil(components.length / componentsPerPage)
  const lastPageIndex = Math.max(0, totalPages - 1)
  const page = Math.min(Math.max(rawPage, 0), lastPageIndex)

  const setPage = (value: number) => {
    const nextPage = Math.min(Math.max(value, 0), lastPageIndex)
    navigate({ to: '.', search: { page: nextPage } })
  }

  const handleClickPrevious: React.MouseEventHandler<HTMLElement> = (e) => {
    if (page === 0) {
      e.preventDefault()
      return
    }
    setPage(page - 1)
  }

  const handleClickNext: React.MouseEventHandler<HTMLElement> = (e) => {
    if (page === lastPageIndex) {
      e.preventDefault()
      return
    }
    setPage(page + 1)
  }

  const filteredComponents = components.filter((_, index) => {
    return (
      index >= page * componentsPerPage &&
      index < (page + 1) * componentsPerPage
    )
  })

  const paginationItems = React.useMemo(
    () =>
      getPaginationItems({
        pageIndex: page,
        totalPages,
        siblingCount: 1,
        boundaryCount: 2,
      }),
    [page, totalPages],
  )

  return (
    <div className="p-2 flex gap-2 flex-col bg-accent h-full overflow-auto">
      <div className="p-2 bg-background flex flex-wrap gap-2 items-center justify-between">
        <Pagination className="w-max mx-0">
          <PaginationContent>
            <PaginationItem>
              <PaginationHoverPreview
                title="前のページの内容"
                pageIndex={page - 1}
                componentsPerPage={componentsPerPage}
                componentNames={components}
              >
                <PaginationPrevious
                  onClick={handleClickPrevious}
                  text="前"
                  aria-disabled={page === 0}
                  tabIndex={page === 0 ? -1 : 0}
                  className={cn({
                    'opacity-50': page === 0,
                  })}
                />
              </PaginationHoverPreview>
            </PaginationItem>
            {paginationItems.map((item, index) => {
              if (item === 'ellipsis') {
                return (
                  <PaginationItem key={`ellipsis-${index}`}>
                    <PaginationEllipsis />
                  </PaginationItem>
                )
              }

              return (
                <PaginationItem key={item}>
                  <PaginationHoverPreview
                    title={`${item + 1}ページの内容`}
                    pageIndex={item}
                    componentsPerPage={componentsPerPage}
                    componentNames={components}
                  >
                    <PaginationLink
                      onClick={() => setPage(item)}
                      isActive={item === page}
                    >
                      {item + 1}
                    </PaginationLink>
                  </PaginationHoverPreview>
                </PaginationItem>
              )
            })}
            <PaginationItem>
              <PaginationHoverPreview
                title="次のページの内容"
                pageIndex={page + 1}
                componentsPerPage={componentsPerPage}
                componentNames={components}
              >
                <PaginationNext
                  onClick={handleClickNext}
                  text="次"
                  aria-disabled={page === lastPageIndex}
                  tabIndex={page === lastPageIndex ? -1 : 0}
                  className={cn({
                    'opacity-50': page === lastPageIndex,
                  })}
                />
              </PaginationHoverPreview>
            </PaginationItem>
          </PaginationContent>
        </Pagination>
        <div className="flex flex-wrap gap-2">
          <ThemeSwitcher />
          <StyleSwitcher />
        </div>
      </div>
      <div className="flex gap-2 flex-wrap h-full overflow-auto">
        {filteredComponents.map((component) => {
          return (
            <Content
              key={component}
              title={formatKebabAsTitle(component)}
              src={`#/ui/${component}`}
              to={`/ui/${component}`}
            />
          )
        })}
      </div>
    </div>
  )
}

function PaginationHoverPreview({
  title,
  pageIndex,
  componentsPerPage,
  componentNames,
  children,
}: {
  title: string
  pageIndex: number
  componentsPerPage: number
  componentNames: ReadonlyArray<string>
  children: React.ReactElement
}) {
  const pageComponents = React.useMemo(() => {
    if (pageIndex < 0) return []
    return componentNames.slice(
      pageIndex * componentsPerPage,
      (pageIndex + 1) * componentsPerPage,
    )
  }, [componentNames, componentsPerPage, pageIndex])

  return (
    <HoverCard>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent side="bottom">
        <div className="style-lyra:gap-1 style-nova:gap-1.5 style-vega:gap-2 style-maia:gap-2 style-mira:gap-1 flex flex-col">
          <h4 className="font-medium">{title}</h4>
          {pageComponents.length > 0 ? (
            pageComponents.map((component) => (
              <p key={component}>{formatKebabAsTitle(component)}</p>
            ))
          ) : (
            <p>なし</p>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
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
  const navigate = useNavigate()
  const { theme: currentTheme } = useTheme()
  const [theme, setTheme] = React.useState<Theme>(currentTheme)
  const { style: currentStyle } = useStyle()
  const [style, setStyle] = React.useState<Style>(currentStyle)

  const handleMessage = React.useCallback(
    (window: Window, data: { theme?: Theme; style?: Style }) => {
      const html = window.document.documentElement

      if (data.style) {
        applyStyle(html, data.style)
      }

      if (data.theme) {
        applyTheme(html, data.theme)
      }
    },
    [],
  )

  const { ref, sendToIframe } = useIframeMessage(handleMessage)

  const handleThemeChange = React.useCallback(
    (value: Theme) => {
      setTheme(value)
      sendToIframe({ theme: value })
    },
    [sendToIframe],
  )

  const handleStyleChange = React.useCallback(
    (value: Style) => {
      setStyle(value)
      sendToIframe({ style: value })
    },
    [sendToIframe],
  )

  return (
    <Card className="h-max w-max">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-2">
          <div>{title}</div>
          <div className="flex gap-2">
            <DemoThemeSwitcher
              value={theme}
              onValueChange={handleThemeChange}
            />
            <DemoStyleSwitcher
              value={style}
              onValueChange={handleStyleChange}
            />
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <iframe
          ref={ref}
          src={src}
          width={550}
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

function DemoThemeSwitcher({
  className = '',
  value = 'light',
  onValueChange = () => {},
}: {
  className?: string
  value?: Theme
  onValueChange?: (value: Theme) => void
}) {
  return (
    <ToggleGroup
      className={className}
      type="single"
      variant="outline"
      value={value}
      onValueChange={(val) => {
        if (val === value) return
        if (val == '') return
        onValueChange(val as Theme)
      }}
    >
      <ToggleGroupItem value="light">
        <SunIcon />
      </ToggleGroupItem>
      <ToggleGroupItem value="dark">
        <MoonIcon />
      </ToggleGroupItem>
    </ToggleGroup>
  )
}

function DemoStyleSwitcher({
  className = '',
  value = 'vega',
  onValueChange = () => {},
}: {
  className?: string
  value?: Style
  onValueChange?: (value: Style) => void
}) {
  return (
    <ToggleGroup
      className={className}
      type="single"
      variant="outline"
      value={value}
      onValueChange={(val) => {
        if (val === value) return
        if (val == '') return
        onValueChange(val as Style)
      }}
    >
      {STYLES.map((style) => (
        <ToggleGroupItem key={style} value={style}>
          {formatKebabAsTitle(style)}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}

/** theme を適用する */
function applyTheme(el: HTMLElement, theme: Theme) {
  const themes = ['light', 'dark', 'system'] as const
  themes.forEach((t) => {
    el.classList.remove(t)
  })

  el.classList.add(theme)
}

/** style を適用する */
function applyStyle(el: HTMLElement, style: Style) {
  STYLES.forEach((s) => {
    el.classList.remove(`style-${s}`)
  })
  el.classList.add(`style-${style}`)
}
