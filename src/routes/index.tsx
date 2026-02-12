import { createFileRoute } from '@tanstack/react-router'
import logo from './logo.svg'

export const Route = createFileRoute('/')({
  component: App,
  loader: () => ({ crumb: 'Home' }),
})

function App() {
  return (
    <div className="text-center h-full">
      <header className="h-full bg-background text-foreground text-[calc(10px+2vmin)] grid place-items-center overflow-hidden">
        <img
          src={logo}
          alt=""
          aria-hidden="true"
          className="col-start-1 row-start-1 h-[70lvh] w-[70lvw] animate-[spin_20s_linear_infinite] pointer-events-none select-none"
        />
        <div className="col-start-1 row-start-1 z-10 flex flex-col items-center justify-center max-w-3xl px-6 bg-background/30 rounded-lg py-4 shadow-lg backdrop-blur-sm">
          Lorem ipsum dolor sit, amet consectetur adipisicing elit. Eaque iste
          blanditiis incidunt cupiditate provident quaerat ipsum repudiandae ex.
          Ipsa repellat provident eligendi placeat iste nisi deserunt tempore
          vel veniam. Non!
        </div>
      </header>
    </div>
  )
}
