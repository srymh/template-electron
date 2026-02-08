import { lazy, Suspense } from "react"
import { SquareIcon } from "lucide-react"

const ICON_LIBRARY_NAME = ['lucide', 'tabler', 'hugeicons', 'phosphor', 'remixicon'] as const
type IconLibraryName = (typeof ICON_LIBRARY_NAME)[number]

const IconLucide = lazy(() =>
  import("./icon-lucide").then((mod) => ({
    default: mod.IconLucide,
  }))
)

export function IconPlaceholder({
  ...props
}: {
  [K in IconLibraryName]: string
} & React.ComponentProps<"svg">) {
  const iconLibrary = 'lucide' as IconLibraryName
  const iconName = props[iconLibrary]

  if (!iconName) {
    return null
  }

  return (
    <Suspense fallback={<SquareIcon {...props} />}>
      {iconLibrary === "lucide" && <IconLucide name={iconName} {...props} />}
    </Suspense>
  )
}
