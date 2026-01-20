import React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { queryOptions, useSuspenseQuery } from '@tanstack/react-query'
import logo from '../logo.svg'
import { api } from '@/api'
import { useTheme } from '@/components/theme-provider'

const getAccentColorQueryOptions = queryOptions({
  queryKey: ['accentColor'],
  queryFn: async () => {
    const color = await api.theme.getAccentColor()
    return `#${color}`
  },
  staleTime: 0,
  gcTime: 0,
  refetchOnMount: true,
})

export const Route = createFileRoute('/')({
  component: App,
  loader: ({ context: { queryClient } }) => {
    queryClient.ensureQueryData(getAccentColorQueryOptions)
    return { crumb: 'Home' }
  },
})

const useAccentColor = () => {
  const { data: initialColor } = useSuspenseQuery(getAccentColorQueryOptions)
  const [accentColor, setAccentColor] = React.useState<string>(initialColor)

  React.useEffect(() => {
    const unsubscribe = api.theme.on.accentColorChanged((newColor) => {
      console.log('Accent color changed:', newColor)
      setAccentColor('#' + newColor)
    })
    return () => {
      unsubscribe()
    }
  }, [])

  return accentColor
}

function App() {
  const accentColor = useAccentColor()
  const { setTheme } = useTheme()

  return (
    <div
      className="text-center h-full"
      style={
        {
          '--accent-color': accentColor,
        } as React.CSSProperties
      }
    >
      <header className="h-full flex flex-col items-center justify-center bg-[#282c34] text-white text-[calc(10px+2vmin)]">
        <img
          src={logo}
          className="h-[40vmin] pointer-events-none animate-[spin_20s_linear_infinite]"
          alt="logo"
        />
        <p>
          Edit <code>src/routes/index.tsx</code> and save to reload.
        </p>
        <a
          className="text-(--accent-color) hover:underline"
          href="https://reactjs.org"
          target="_blank"
          rel="noopener noreferrer"
        >
          Learn React
        </a>
        <a
          className="text-(--accent-color) hover:underline"
          href="https://tanstack.com"
          target="_blank"
          rel="noopener noreferrer"
        >
          Learn TanStack
        </a>
        <button
          className="text-(--accent-color) hover:underline"
          onClick={async () => {
            const theme = await api.theme.getTheme()
            alert(`Current theme: ${theme}`)
          }}
        >
          Get Current Theme
        </button>
        <div className="flex gap-2">
          <button
            className="text-xs size-16 rounded bg-(--accent-color) text-black hover:bg-[#21a1f1]"
            onClick={() => {
              setTheme('dark')
            }}
          >
            Set Theme to Dark
          </button>
          <button
            className="text-xs size-16 rounded bg-(--accent-color) text-black hover:bg-[#21a1f1]"
            onClick={() => {
              setTheme('light')
            }}
          >
            Set Theme to Light
          </button>
          <button
            className="text-xs size-16 rounded bg-(--accent-color) text-black hover:bg-[#21a1f1]"
            onClick={() => {
              setTheme('system')
            }}
          >
            Set Theme to System
          </button>
        </div>
      </header>
    </div>
  )
}
