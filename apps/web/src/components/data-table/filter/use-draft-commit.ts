import { useDebouncer } from '@tanstack/react-pacer'

import type { Updater } from './filter-fns'

/**
 * {@link useDraftCommit} の設定。
 *
 * @remarks
 * 下書きの読み書きはテーブル（`filterDraftFeature`）が所有し、このフックは待機と確定の時機だけを持つ。
 */
type DraftCommitOptions = {
  /** 下書きを書く（`column.setFilterDraft` など）。 */
  write: (updater: Updater<unknown>) => void
  /** 下書きを確定する（`column.commitFilterDraft` など）。下書きがなければ何もしない。 */
  commit: () => void
  /** 下書きを捨てる（`column.discardFilterDraft` など）。 */
  discard: () => void
  /** 最後の書き込みから確定までの待機時間（ms）。 */
  wait: number
  /** アンマウント時に、待機中の下書きをすぐに確定するか（`flush`）、捨てるか（`discard`）。 */
  onUnmount: 'flush' | 'discard'
}

/**
 * 入力のたびに下書きを書き、最後の書き込みから待機時間が経ったら確定する関数を返す。
 *
 * @remarks
 * 待機は TanStack Pacer の `useDebouncer` に任せる。待機中に解除や `table.reset()` で下書きが消えると、
 * 待機後の確定は何もしない。確定値が外から変わった場合も、テーブルが下書きを無効にして適用しない。
 * そのため、解除の側から待機を取り消す必要はない。
 * @param options - 下書きの読み書き・待機時間・アンマウント時の扱い
 * @returns 入力欄の値の更新を受け取り、下書きを書いて確定を待つ関数
 */
export function useDraftCommit({ write, commit, discard, wait, onUnmount }: DraftCommitOptions) {
  const debouncer = useDebouncer(commit, {
    wait,
    onUnmount: (pending) => {
      if (onUnmount === 'flush') {
        pending.flush()
        return
      }
      pending.cancel()
      discard()
    },
  })

  return (updater: Updater<unknown>) => {
    write(updater)
    debouncer.maybeExecute()
  }
}
