import { Menu } from 'electron'
import type { WebContents } from 'electron'

export const createContextMenu = (webContents: WebContents) => {
  const menu = Menu.buildFromTemplate([
    {
      label: 'コピー',
      role: 'copy',
    },
    {
      label: '貼り付け',
      role: 'paste',
    },
    {
      label: '切り取り',
      role: 'cut',
    },
    {
      label: '元に戻す',
      role: 'undo',
    },
    {
      label: 'やり直す',
      role: 'redo',
    },
    {
      type: 'separator',
    },
    {
      label: '開発者ツールを開く',
      click: () => webContents.openDevTools(),
    },
  ])
  return menu
}
