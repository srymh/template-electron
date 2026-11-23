import { useId } from 'react'
import type { ReactNode, Ref } from 'react'

import { cn } from '@repo/ui/lib/utils'

// 選択状態・フォーカスを、内側の非表示の input から受け取る見た目
const choiceClassName =
  'has-focus-visible:ring-ring/50 flex h-7 cursor-pointer items-center gap-1.5 rounded-md px-2 whitespace-nowrap transition-colors select-none has-focus-visible:ring-2 [&_svg]:size-3.5 [&_svg]:shrink-0'

/**
 * 設定パネル内の一つの設定項目のまとまり。見出しの行の右端に、項目全体に関わる操作や状態を置ける。
 *
 * @remarks
 * 見出しを名前とする group として描画し、中の操作がどの項目に属するかを支援技術にも伝える。
 */
export function SettingsSection({
  title,
  action,
  children,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
}) {
  const titleId = useId()

  return (
    <div role="group" aria-labelledby={titleId} className="flex flex-col gap-1.5">
      <div className="flex min-h-5 items-center justify-between gap-2">
        <h3 id={titleId} className="text-muted-foreground font-medium">
          {title}
        </h3>
        {action}
      </div>
      {children}
    </div>
  )
}

/**
 * アイコンと短い名前で示す、オン・オフを切り替えるチップ。
 *
 * @remarks
 * 実体はチェックボックスで、オンの間は枠と背景の色で強調する。
 * 見出しで対象が分かるため表示する名前は短くし、`accessibleName` で完全な名前を与える。
 * `inputRef` は、呼び出し側がこの設定へフォーカスを移すために使う。
 */
export function ToggleChip({
  icon,
  label,
  accessibleName,
  checked,
  onCheckedChange,
  inputRef,
}: {
  icon: ReactNode
  label: string
  accessibleName?: string
  inputRef?: Ref<HTMLInputElement>
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <label
      className={cn(
        choiceClassName,
        'border-input text-muted-foreground hover:bg-muted hover:text-foreground border',
        'has-checked:border-primary has-checked:bg-primary/10 has-checked:text-foreground',
      )}
    >
      <input
        ref={inputRef}
        type="checkbox"
        className="sr-only"
        aria-label={accessibleName}
        checked={checked}
        onChange={(event) => onCheckedChange(event.target.checked)}
      />
      {icon}
      {label}
    </label>
  )
}

/** {@link SegmentedControl} の一つの選択肢。 */
export type SegmentedOption<T> = {
  value: T
  label: string
  icon: ReactNode
  /** 表示する名前より詳しい、支援技術向けの名前とツールチップ。 */
  accessibleName?: string
}

/**
 * 排他的な選択肢を一続きの区画として並べ、選んだ区画を浮き上がらせて示す切り替え。
 *
 * @remarks
 * 実体は同じ `name` を持つラジオボタンで、矢印キーでの移動はブラウザの既定に任せる。
 * 選択肢は2つずつ組にして等幅に並べる。すべてが1行に収まらない幅では、組ごとに折り返して
 * 2列で表示し、区画の文字やアイコンが重ならないようにする。右端の区画は折り返しても右端に残るため、
 * 区画の位置で他の操作（高さの入力欄など）と対応付けられる。
 */
export function SegmentedControl<T extends string | boolean>({
  name,
  options,
  value,
  onValueChange,
}: {
  name: string
  options: ReadonlyArray<SegmentedOption<T>>
  value: T
  onValueChange: (value: T) => void
}) {
  // 2つずつの組。組は内容の幅より縮まず、収まらなければ次の行へ折り返す
  const optionPairs = Array.from({ length: Math.ceil(options.length / 2) }, (_, index) =>
    options.slice(index * 2, index * 2 + 2),
  )

  return (
    <div className="bg-muted flex flex-wrap gap-0.5 rounded-md p-0.5">
      {optionPairs.map((pair) => (
        <div
          key={pair.map((option) => String(option.value)).join('-')}
          className="grid min-w-max flex-1 basis-0 grid-cols-2 gap-0.5"
        >
          {pair.map((option) => (
            <label
              key={String(option.value)}
              title={option.accessibleName}
              className={cn(
                choiceClassName,
                'text-muted-foreground hover:text-foreground h-6 justify-center rounded-sm',
                'has-checked:bg-background has-checked:text-foreground has-checked:shadow-xs',
                pair.length === 1 && 'col-span-2',
              )}
            >
              <input
                type="radio"
                className="sr-only"
                name={name}
                aria-label={option.accessibleName}
                checked={value === option.value}
                onChange={() => onValueChange(option.value)}
              />
              {option.icon}
              {option.label}
            </label>
          ))}
        </div>
      ))}
    </div>
  )
}
