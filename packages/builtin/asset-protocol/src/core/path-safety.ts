import path from 'node:path'

/** root 配下の相対パスを絶対パスに解決する。symlink の検証は読み込み直前に行う。 */
export function resolvePathInsideRoot(root: string, relativePath: string): string {
  const rootPath = path.resolve(root)
  const targetPath = path.resolve(rootPath, relativePath)
  assertPathIsInsideRoot(rootPath, targetPath, `Asset path escapes root: ${relativePath}`)
  return targetPath
}

/** root 配下にある絶対ファイルパスから、URL 用の相対パスを作る。 */
export function createRelativePathInsideRoot(root: string, filePath: string): string {
  if (!path.isAbsolute(filePath)) {
    throw new Error(`Asset file path must be absolute: ${filePath}`)
  }

  const rootPath = path.resolve(root)
  const targetPath = path.resolve(filePath)
  const relativeFromRoot = path.relative(rootPath, targetPath)
  if (!relativeFromRoot) {
    throw new Error(`Asset file path must point to a file inside root: ${filePath}`)
  }

  assertPathIsInsideRoot(rootPath, targetPath, `Asset file path escapes root: ${filePath}`)
  return relativeFromRoot.split(path.sep).join('/')
}

function assertPathIsInsideRoot(rootPath: string, targetPath: string, message: string): void {
  const relativeFromRoot = path.relative(rootPath, targetPath)
  if (
    relativeFromRoot === '..' ||
    relativeFromRoot.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativeFromRoot)
  ) {
    throw new Error(message)
  }
}
