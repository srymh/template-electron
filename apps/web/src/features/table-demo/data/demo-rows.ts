/** 検証用の表の1行。全6種類の列フィルターと、NULL・0・false・長文・複数行を含む。 */
export type DemoRow = {
  /** 行 ID。生成順の連番で、再読み込みしても同じ値になる。 */
  id: string
  /** 文字列フィルター（`text`）の対象。 */
  name: string
  /** 選択フィルター（`select`）の対象。NULL を含む。 */
  kind: string | null
  /** 数値範囲フィルター（`number-range`）の対象。0 と NULL を含む。 */
  level: number | null
  /** 数値の選択フィルター（`number-equals`）の対象。 */
  rank: number
  /** 真偽値フィルター（`boolean`）の対象。 */
  active: boolean
  /** 日付範囲フィルター（`date-range`）の対象。`YYYY-MM-DD` 形式。 */
  date: string
  /** 長文・複数行を含む本文。行の高さを変える。 */
  note: string
  /** 値のない行が多い列。 */
  optional: string | null
}

/** 検証画面の既定の行数。 */
export const demoRowCount = 300

const kinds = ['炎', '水', '草', '電気', 'ノーマル'] as const

const noteSamples = [
  '短い本文',
  '列幅を狭めたときの省略表示と、列幅を固定しない場合の折り返しを確認するための長い本文です。',
  '1行目\n2行目\n3行目',
  '複数行の本文\n固定行の高さが変わっても、固定位置が重ならないことを確認する。',
  '',
] as const

/**
 * 同じ種から同じ並びを返す疑似乱数（mulberry32）を作る。
 *
 * @param seed - 乱数の種
 * @returns 呼ぶたびに `[0, 1)` の数を返す関数
 */
function createRandom(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * 検証用の行を生成する。DB・API を使わず、同じ件数なら毎回同じ内容を返す。
 *
 * @param count - 生成する行数
 * @returns `row-000` からの連番の ID を持つ行
 */
export function createDemoRows(count = demoRowCount): DemoRow[] {
  const random = createRandom(20261109)
  const pick = <T>(values: readonly T[]) => values[Math.floor(random() * values.length)]!

  return Array.from({ length: count }, (_, index) => {
    const number = String(index).padStart(3, '0')
    const day = new Date(Date.UTC(2026, 0, 1 + Math.floor(random() * 365)))
    return {
      id: `row-${number}`,
      name: `行-${number}`,
      // 7行に1行は NULL にする
      kind: index % 7 === 3 ? null : pick(kinds),
      // 0 と NULL を必ず含める
      level: index % 11 === 5 ? null : index % 13 === 0 ? 0 : Math.floor(random() * 100),
      rank: 1 + Math.floor(random() * 5),
      active: random() < 0.6,
      date: day.toISOString().slice(0, 10),
      note: pick(noteSamples),
      optional: index % 4 === 0 ? `任意-${number}` : null,
    }
  })
}
