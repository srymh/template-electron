import * as React from 'react'

import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { MoonIcon, SunIcon } from 'lucide-react'
import { z } from 'zod'

import { components } from '@repo/shadcn/demo/constants'
import { THEMES, useStyle, useTheme, STYLES } from '@repo/shadcn/design-system'
import type { StyleName, ThemeName } from '@repo/shadcn/design-system'
import { cn } from '@repo/shadcn/lib/utils'
import { Button } from '@repo/shadcn/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@repo/shadcn/ui/card'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@repo/shadcn/ui/hover-card'
import { Item } from '@repo/shadcn/ui/item'
import { Label } from '@repo/shadcn/ui/label'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@repo/shadcn/ui/pagination'
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@repo/shadcn/ui/popover'
import { ToggleGroup, ToggleGroupItem } from '@repo/shadcn/ui/toggle-group'
import type { ThemeApi } from '@your-app-name/api'

import { useTheme as useAppearanceMode } from '@/components/theme-provider'
import { ThemeSwitcher as ModeSwitcher } from '@/components/theme-switcher'
import { StyleSwitcher } from '@/features/style/components/style-switcher'
import { ThemeSwitcher } from '@/features/style/components/theme-switcher'
import { useIframeMessage } from '@/hooks/use-iframe-message'
import { formatKebabAsTitle } from '@/lib/format-kebab-as-title'
import { getPaginationItems } from '@/lib/pagination'

export type AppearanceMode = Awaited<ReturnType<ThemeApi['getTheme']>>

type IframeDesignMessage = {
  mode: AppearanceMode
  theme: ThemeName
  style: StyleName
}

const DESIGN_FRAME_MESSAGE_TYPE = 'design'

const SearchSchema = z.object({
  page: z.number().default(0).optional(),
})

export const Route = createFileRoute('/(app)/ui/')({
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

  const filteredComponents = components.filter((_, index) => {
    return index >= page * componentsPerPage && index < (page + 1) * componentsPerPage
  })

  return (
    <div className="p-2 flex gap-2 flex-col bg-accent h-full overflow-auto">
      <div className="p-2 bg-background flex flex-wrap gap-2 items-center justify-start border border-border">
        <Item size="xs" variant="outline" className="flex-col w-fit items-start">
          <Label className="text-muted-foreground text-xs">モード</Label>
          <ModeSwitcher />
        </Item>
        <Item size="xs" variant="outline" className="flex-col w-fit items-start">
          <Label className="text-muted-foreground text-xs">スタイル</Label>
          <StyleSwitcher />
        </Item>
        <Item size="xs" variant="outline" className="flex-col w-fit items-start">
          <Label className="text-muted-foreground text-xs">テーマ</Label>
          <ThemeSwitcher className="text-xs" />
        </Item>
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

      <Pagination className="bg-background border border-border">
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
                  <PaginationLink onClick={() => setPage(item)} isActive={item === page}>
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
    return componentNames.slice(pageIndex * componentsPerPage, (pageIndex + 1) * componentsPerPage)
  }, [componentNames, componentsPerPage, pageIndex])

  return (
    <HoverCard>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent side="top">
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

function Content({ title, src, to }: { title: string; src: string; to: string }) {
  const navigate = useNavigate()
  const { ref, config, setMode, setTheme, setStyle, handleIframeLoad } = useDesignPreviewFrame()

  return (
    <Card className="h-max w-max">
      <CardHeader>
        <CardTitle className="flex flex-col gap-2">
          <div className="text-lg font-semibold">{title}</div>
          <div className="flex gap-2">
            <DemoModeSwitcher value={config.mode} onValueChange={setMode} />
            <DemoStyleSwitcher value={config.style} onValueChange={setStyle} />
            <DemoThemeSwitcher value={config.theme} onValueChange={setTheme} />
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <iframe
          ref={ref}
          src={src}
          width={550}
          height={550}
          className="border rounded-xl"
          onLoad={handleIframeLoad}
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

function useDesignPreviewFrame() {
  const { theme: currentMode } = useAppearanceMode()
  const { theme: currentTheme } = useTheme()
  const { style: currentStyle } = useStyle()
  const [config, setConfig] = React.useState<IframeDesignMessage>({
    mode: currentMode,
    theme: currentTheme,
    style: currentStyle,
  })
  const { ref, sendToIframe, handleLoad, isReady } =
    useIframeMessage<IframeDesignMessage>(DESIGN_FRAME_MESSAGE_TYPE)

  React.useEffect(() => {
    setConfig((current) =>
      current.mode === currentMode ? current : { ...current, mode: currentMode },
    )
  }, [currentMode])

  React.useEffect(() => {
    setConfig((current) =>
      current.theme === currentTheme ? current : { ...current, theme: currentTheme },
    )
  }, [currentTheme])

  React.useEffect(() => {
    setConfig((current) =>
      current.style === currentStyle ? current : { ...current, style: currentStyle },
    )
  }, [currentStyle])

  React.useEffect(() => {
    if (!isReady) return
    sendToIframe(config)
  }, [config, isReady, sendToIframe])

  const handleIframeLoad = React.useCallback(() => {
    handleLoad()
    sendToIframe(config)
  }, [config, handleLoad, sendToIframe])

  const handleModeChange = React.useCallback((value: AppearanceMode) => {
    setConfig((current) => ({ ...current, mode: value }))
  }, [])

  const handleThemeChange = React.useCallback((value: ThemeName) => {
    setConfig((current) => ({ ...current, theme: value }))
  }, [])

  const handleStyleChange = React.useCallback((value: StyleName) => {
    setConfig((current) => ({ ...current, style: value }))
  }, [])

  return {
    ref,
    config,
    setMode: handleModeChange,
    setTheme: handleThemeChange,
    setStyle: handleStyleChange,
    handleIframeLoad,
  }
}

function DemoModeSwitcher({
  className = '',
  value = 'light',
  onValueChange = () => {},
}: {
  className?: string
  value?: AppearanceMode
  onValueChange?: (value: AppearanceMode) => void
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
        onValueChange(val as AppearanceMode)
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

function DemoThemeSwitcher({
  className = '',
  value = 'neutral',
  onValueChange = () => {},
}: {
  className?: string
  value?: ThemeName
  onValueChange?: (value: ThemeName) => void
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn(className, 'min-w-20 flex items-center')}>
          {formatKebabAsTitle(value)}
          <div
            className="size-4 rounded-full"
            style={{
              backgroundColor: THEMES.find((t) => t.name === value)?.cssVars!.light?.primary,
            }}
          ></div>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-fit">
        <PopoverHeader>
          <PopoverTitle>テーマを選択</PopoverTitle>
          <PopoverDescription>テーマを選択してください</PopoverDescription>
          <ToggleGroup
            className="overflow-auto max-h-60 min-w-32"
            type="single"
            variant="outline"
            orientation="vertical"
            value={value}
            onValueChange={(val) => {
              if (val === value) return
              if (val == '') return
              onValueChange(val as ThemeName)
            }}
          >
            {THEMES.map((theme) => (
              <ToggleGroupItem
                key={theme.name}
                value={theme.name}
                className="flex justify-between items-center"
              >
                {theme.title}
                <div
                  className="size-4 rounded-full"
                  style={{
                    backgroundColor: theme.cssVars!.light?.primary,
                  }}
                ></div>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </PopoverHeader>
      </PopoverContent>
    </Popover>
  )
}

function DemoStyleSwitcher({
  className = '',
  value = 'vega',
  onValueChange = () => {},
}: {
  className?: string
  value?: StyleName
  onValueChange?: (value: StyleName) => void
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
        onValueChange(val as StyleName)
      }}
    >
      {STYLES.map(({ name: style }) => (
        <ToggleGroupItem key={style} value={style}>
          {formatKebabAsTitle(style)}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
