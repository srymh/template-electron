import React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { web } from '@/api'

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'

export const Route = createFileRoute('/demo/web')({
  component: RouteComponent,
  loader: () => ({ crumb: 'Web Events' }),
})

const useBlurState = () => {
  const [isBlurred, setIsBlurred] = React.useState(false)

  React.useEffect(() => {
    const unsubscribeBlur = web.on.blur(() => {
      setIsBlurred(true)
    })
    const unsubscribeFocus = web.on.focus(() => {
      setIsBlurred(false)
    })

    return () => {
      unsubscribeBlur()
      unsubscribeFocus()
    }
  }, [])

  return isBlurred
}

const useBlurStateByBrowser = () => {
  const [isBlurred, setIsBlurred] = React.useState(false)

  React.useEffect(() => {
    const handleBlur = () => setIsBlurred(true)
    const handleFocus = () => setIsBlurred(false)

    window.addEventListener('blur', handleBlur)
    window.addEventListener('focus', handleFocus)

    return () => {
      window.removeEventListener('blur', handleBlur)
      window.removeEventListener('focus', handleFocus)
    }
  }, [])

  return isBlurred
}

const useFoundInPage = () => {
  React.useEffect(() => {
    const unsubscribeFoundInPage = web.on.foundInPage((result) => {
      console.log('Found in page:', result)
    })

    return () => {
      unsubscribeFoundInPage()
    }
  }, [])
}

function RouteComponent() {
  const isBlurred = useBlurState()
  const isBlurredByBrowser = useBlurStateByBrowser()
  useFoundInPage()

  return (
    <ContextMenuWrapper>
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4">Web Events Demo</h1>
        <p className="mb-4">
          This page demonstrates how to subscribe to web events in Electron.
        </p>
        <div className="p-4 bg-gray-100 rounded">
          <h2 className="text-xl font-semibold mb-2">Web Focus State</h2>
          <p className="text-lg">
            The web contents is currently{' '}
            <span className={isBlurred ? 'text-red-500' : 'text-green-500'}>
              {isBlurred ? 'blurred' : 'focused'}
            </span>
          </p>

          <h2 className="text-xl font-semibold mt-4 mb-2">
            Browser Focus State
          </h2>
          <p className="text-lg">
            The browser window is currently{' '}
            <span
              className={isBlurredByBrowser ? 'text-red-500' : 'text-green-500'}
            >
              {isBlurredByBrowser ? 'blurred' : 'focused'}
            </span>
          </p>
        </div>
        <pre className="mt-4 p-4 bg-gray-200 rounded whitespace-pre-wrap">
          Electronの `electronApi.web.subscribeBlur` や `subscribeFocus`
          は、Electronのメインプロセスやプリロードスクリプト経由で「ウィンドウ全体のフォーカス状態」を検知するための独自APIです。
          一方、Web標準API（例: `window.addEventListener('blur', ...)` や
          `focus`）は、**ブラウザやWebViewのウィンドウがアクティブかどうか**を検知します。
          主な違いは以下の通りです： ###
          Electron独自API（`electronApi.web.subscribeBlur` など） -
          Electronアプリのウィンドウ全体の状態を検知できる -
          メインプロセスやプリロードスクリプト経由でイベントを受け取る -
          Web標準APIよりも「アプリ全体の状態」に近い ###
          Web標準API（`window.addEventListener('blur', ...)` など） -
          ブラウザやWebViewのウィンドウがアクティブかどうかを検知 -
          Electron以外の通常のWebアプリでも動作 -
          Electronでも使えるが、Electron独自APIほど細かい制御はできない場合がある
          #### まとめ - **Electron
          API**はElectronアプリ専用で、よりアプリ全体の状態を正確に検知できる -
          **Web標準API**は汎用的で、Electron以外でも使えるが、検知できる範囲がやや狭い
          どちらを使うかは、アプリの要件や動作させたい環境によって選択します。
        </pre>

        <div className="mt-4">
          <button
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            onClick={() => {
              web.findInPage({ text: 'Electron' })
            }}
          >
            Find in Page
          </button>
        </div>
      </div>
    </ContextMenuWrapper>
  )
}

function ContextMenuWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ContextMenu>
      <ContextMenuTrigger>{children}</ContextMenuTrigger>

      {/* 右クリックメニュー */}
      <ContextMenuContent>
        <ContextMenuItem
          onSelect={() => {
            const text = window.getSelection()?.toString() || ''
            if (text) {
              web.findInPage({ text })
            }
          }}
        >
          探す
        </ContextMenuItem>
        <ContextMenuItem
          onSelect={() => {
            web.stopFindInPage({ action: 'clearSelection' })
          }}
        >
          探すのをやめる
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
