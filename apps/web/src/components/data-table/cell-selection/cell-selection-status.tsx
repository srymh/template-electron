import { useEffect, useState } from 'react'

import { CopyIcon } from 'lucide-react'

import { Button } from '@repo/ui/components/button'

import type { DataTableContexts } from '../contexts'

/**
 * factoryのコンテキストへ、CellSelectionStatusを含む表示部品を結び付ける。
 * @param contexts - 同じ機能登録で作ったコンテキストと読取フック
 * @returns 同じfactory内で参照を保って登録する表示部品
 */
export function createCellSelectionStatus<TMeta extends object>(
  contexts: DataTableContexts<TMeta>,
) {
  const { useTableContext } = contexts

  /**
   * 選択中のセル数・値・コピー操作を1段に収める下部の状態表示。
   * 長い値は省略表示し、選択範囲全体を TSV としてコピーする。
   *
   * @remarks
   * 複数の範囲は空行で区切る。数式として解釈されうる文字列（先頭の空白・タブを
   * 除いて `=`・`+`・`-`・`@` で始まるもの）には `'` を前置し、区切り文字・
   * 改行・引用符を含む値は引用符で囲む。
   * コピーの成功・失敗は `role="status"` の文言で2秒間通知する。
   */
  function CellSelectionStatus() {
    const table = useTableContext()
    // id はコピーを実行するたびに変え、同じ結果が続いても通知とタイマーを更新する
    const [copyNotice, setCopyNotice] = useState<{ id: number; status: 'copied' | 'failed' }>()

    // 通知は最後のコピーから一定時間後に消す
    useEffect(() => {
      if (!copyNotice) return
      const timeoutId = setTimeout(() => setCopyNotice(undefined), 2000)
      return () => clearTimeout(timeoutId)
    }, [copyNotice])

    const notifyCopy = (status: 'copied' | 'failed') => {
      setCopyNotice((prev) => ({ id: (prev?.id ?? 0) + 1, status }))
    }

    // Clipboard API が使えない環境（非セキュアコンテキストなど）でも、失敗として通知する
    const handleCopy = async () => {
      try {
        await navigator.clipboard.writeText(toTsv(table.getSelectedCellRangesData()))
        notifyCopy('copied')
      } catch {
        notifyCopy('failed')
      }
    }

    return (
      <div className="text-muted-foreground flex h-7 min-w-0 flex-nowrap items-center gap-1.5 px-2 text-[11px]">
        <table.Subscribe
          selector={() =>
            [table.getSelectedCellCount(), toTsv(table.getSelectedCellRangesData())] as const
          }
        >
          {([count, tsv]) => (
            <>
              <span className="shrink-0 whitespace-nowrap tabular-nums">選択 {count} セル</span>
              <span className="min-w-0 flex-1 truncate font-mono">
                {tsv.replaceAll('\t', ', ').replaceAll('\n', '; ')}
              </span>
            </>
          )}
        </table.Subscribe>
        {/* 同じ文言でも読み上げられるよう、実行ごとに子要素を作り直す */}
        <span role="status" className="shrink-0 whitespace-nowrap">
          {copyNotice && (
            <span key={copyNotice.id}>
              {copyNotice.status === 'copied' ? 'コピーしました' : 'コピーできませんでした'}
            </span>
          )}
        </span>
        <Button
          size="icon-xs"
          variant="ghost"
          aria-label="選択したセルをコピー"
          title="選択したセルをコピー"
          onClick={handleCopy}
        >
          <CopyIcon />
        </Button>
      </div>
    )
  }

  function escapeTsvValue(value: unknown) {
    const text = value == null ? '' : String(value)
    const safeText = typeof value === 'string' && /^[\t\r ]*[=+@-]/.test(value) ? `'${text}` : text
    // 区切り文字・改行・引用符を含む値は、表計算ソフトの想定どおり引用符で囲み、内側の引用符を重ねる
    return /["\t\n\r]/.test(safeText) ? `"${safeText.replace(/"/g, '""')}"` : safeText
  }

  function toTsv(ranges: Array<Array<Array<unknown>>>) {
    return ranges
      .map((grid) => grid.map((row) => row.map(escapeTsvValue).join('\t')).join('\n'))
      .join('\n\n')
  }

  return { CellSelectionStatus }
}
