import { createFileRoute } from '@tanstack/react-router'

import logo from '@/assets/logo.svg'

export const Route = createFileRoute('/')({
  component: App,
  loader: () => ({ crumb: 'Home' }),
})

/** テンプレートの最初に表示するホーム画面。ロゴとアプリ名だけを中央に表示する。 */
function App() {
  return (
    <div className="bg-background text-foreground flex h-full w-full flex-col items-center justify-center overflow-hidden text-[calc(10px+2vmin)]">
      <img
        src={logo}
        aria-hidden="true"
        className="pointer-events-none h-[40vmin] animate-[spin_20s_linear_infinite] select-none"
      />
      <div className="z-10 rounded backdrop-blur-xs">Electron Template</div>
    </div>
  )
}
