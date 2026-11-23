import path from 'node:path'

import { createRelativePathInsideRoot, resolvePathInsideRoot } from './path-safety'
import { validateAppAssetRootId } from './root-registry'
import type { AppAssetRoot, AppAssetRootRegistry } from './root-registry'

export type AppAssetDescriptor = {
  rootId: string
  relativePath: string
  searchParams?: Readonly<Record<string, string>>
}
export type AppAssetFilePathDescriptor = { rootId: string; filePath: string }
export type AppAssetProtocolFile = { filePath: string; root: AppAssetRoot }
export type AppAssetProtocolTarget = {
  relativePath: string
  root: AppAssetRoot
  searchParams: URLSearchParams
}

const APP_ASSET_PROTOCOL = 'app-asset:'

/** 登録 root 内の相対識別子を app-asset URL に変換する。 */
export function createAppAssetUrl(options: AppAssetDescriptor): string {
  validateAppAssetRootId(options.rootId)
  const relativePath = normalizeAssetRelativePath(options.relativePath)
  const encodedPath = relativePath.split('/').map(encodeURIComponent).join('/')
  const search = new URLSearchParams(options.searchParams).toString()
  return `${APP_ASSET_PROTOCOL}//${options.rootId}/${encodedPath}${search ? `?${search}` : ''}`
}

/** directory root 内の絶対ファイルパスを app-asset URL に変換する。 */
export function createAppAssetUrlFromFilePath(
  options: AppAssetFilePathDescriptor,
  registry: AppAssetRootRegistry,
): string {
  const root = registry.getOrThrow(options.rootId)
  if (root.resolution !== 'directory') {
    throw new Error(`Provider-backed app asset root does not accept file paths: ${options.rootId}`)
  }
  return createAppAssetUrl({
    rootId: options.rootId,
    relativePath: createRelativePathInsideRoot(root.basePath, options.filePath),
  })
}

export function resolveAppAssetProtocolFilePath(
  requestUrl: string,
  registry: AppAssetRootRegistry,
): string {
  return resolveAppAssetProtocolFile(requestUrl, registry).filePath
}

export function resolveAppAssetProtocolFile(
  requestUrl: string,
  registry: AppAssetRootRegistry,
): AppAssetProtocolFile {
  const { relativePath, root } = resolveAppAssetProtocolTarget(requestUrl, registry)
  if (root.resolution !== 'directory') {
    throw new Error(`Provider-backed app asset root requires asynchronous resolution: ${root.id}`)
  }
  return { filePath: resolvePathInsideRoot(root.basePath, relativePath), root }
}

/** URL を登録済み root と、その root が解釈する相対識別子へ分解する。 */
export function resolveAppAssetProtocolTarget(
  requestUrl: string,
  registry: AppAssetRootRegistry,
): AppAssetProtocolTarget {
  const url = new URL(requestUrl)
  if (url.protocol !== APP_ASSET_PROTOCOL) throw new Error(`Unsupported protocol: ${url.protocol}`)
  assertRawAssetUrlDoesNotContainTraversal(requestUrl)
  return {
    relativePath: normalizeAssetRelativePath(decodeURIComponent(url.pathname.replace(/^\/+/, ''))),
    root: registry.getOrThrow(url.host),
    searchParams: url.searchParams,
  }
}

function normalizeAssetRelativePath(relativePath: string): string {
  if (!relativePath) throw new Error('Asset path is empty')
  const normalizedPath = relativePath.replaceAll('\\', '/')
  if (normalizedPath.includes('\0')) throw new Error('Asset path contains null byte')
  if (path.posix.isAbsolute(normalizedPath) || path.win32.isAbsolute(normalizedPath)) {
    throw new Error(`Asset path must be relative: ${relativePath}`)
  }
  if (normalizedPath.split('/').some((segment) => segment === '.' || segment === '..')) {
    throw new Error(`Asset path contains traversal segment: ${relativePath}`)
  }
  return normalizedPath
}

function assertRawAssetUrlDoesNotContainTraversal(requestUrl: string): void {
  const rawPathname = requestUrl.replace(/^[^:]+:\/\/[^/?#]*/, '').split(/[?#]/, 1)[0]
  const rawRelativePath = rawPathname.replace(/^\/+/, '')
  if (!rawRelativePath) return
  const normalizedPath = decodeURIComponent(rawRelativePath).replaceAll('\\', '/')
  if (normalizedPath.split('/').some((segment) => segment === '.' || segment === '..')) {
    throw new Error(`Asset path contains traversal segment: ${rawRelativePath}`)
  }
}
