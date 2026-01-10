import { Link, isMatch, useLocation, useMatches } from '@tanstack/react-router'
import React from 'react'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'

/**
 * パンくずリストコンポーネント
 *
 * 各ルートの `loader` 関数で `crumb` プロパティを返すことで、パンくずリストを構築します。
 *
 * 例:
 * ```tsx
 * export const Route = createFileRoute('/dependencies/axios')({
 *  component: RouteComponent,
 *  loader: () => ({ crumb: 'Axios' }),
 * })
 * ```
 *
 * 参考元:
 * > (原文) https://github.com/TanStack/router/discussions/962#discussioncomment-10456397
 * >
 * > (日本語訳)
 * > 最近、`useMatches` を使用した実験的な変更を通じて、パンくずリストに対処しようとしています。
 * > この変更の目的は、パンくずリストや類似の機能を型安全に構築できる方法を提供することです。
 * > まず、`useMatches` は識別可能なユニオン型を返すため、`fullPath` や `routeId` を基に
 * > 一致を絞り込むことが可能です。次に、TypeScript の型述語（type predicate）である `isMatch`
 * > という関数を使うことで、特定の一致の形状に基づいてフィルタリングや絞り込みが可能です。
 * > 例えば、`matches.filter(match => isMatch(match, 'context.crumb'))` を使用すると、
 * > `context` 内に `crumb` プロパティを持つ一致だけを絞り込むことができます。
 * >
 * > [#2058](https://github.com/TanStack/router/pull/2058)
 * >
 * > 現在、「キッチンシンク」の例にパンくずリストを追加しています。
 * > [キッチンシンク例のBreadcrumbsコードはこちら](https://github.com/TanStack/router/blob/main/examples/react/kitchen-sink-file-based/src/components/Breadcrumbs.tsx)
 *
 */
export const Breadcrumbs = () => {
  const matches = useMatches()
  const location = useLocation()

  if (matches.some((match) => match.status === 'pending')) {
    return null
  }

  const matchesWithCrumbs = matches.filter((match) =>
    isMatch(match, 'loaderData.crumb'),
  )

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {matchesWithCrumbs.map((match, i) => (
          <React.Fragment key={match.fullPath}>
            <BreadcrumbItem className="hidden md:block">
              {location.pathname === match.fullPath ? (
                <BreadcrumbPage>{match.loaderData?.crumb}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink asChild>
                  <Link to={match.routeId}>{match.loaderData?.crumb}</Link>
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
            {i + 1 < matchesWithCrumbs.length ? (
              <BreadcrumbSeparator className="hidden md:block" />
            ) : null}
          </React.Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
