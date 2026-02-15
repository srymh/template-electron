import { createFileRoute } from '@tanstack/react-router'
import logo from '@/assets/logo.svg'

export const Route = createFileRoute('/')({
  component: App,
  loader: () => ({ crumb: 'Home' }),
})

function App() {
  return (
    <div className="w-full h-full items-center justify-center overflow-hidden bg-background text-foreground text-[calc(10px+2vmin)] flex flex-col">
      <img
        src={logo}
        aria-hidden="true"
        className="h-[40vmin] animate-[spin_20s_linear_infinite] pointer-events-none select-none"
      />
      <div className="z-10 backdrop-blur-xs rounded">Electron Template</div>
    </div>
  )
}
