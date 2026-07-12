import { nativeTheme } from 'electron'

import { switchThemeDarkToolDef, switchThemeLightToolDef } from './definitions'

export const switchThemeDarkTool = switchThemeDarkToolDef.server(async () => {
  nativeTheme.themeSource = 'dark'
  console.log('theme', 'dark')
  return {
    content: [{ type: 'text', text: `テーマを「dark」に変更しました。` }],
  }
})

export const switchThemeLightTool = switchThemeLightToolDef.server(async () => {
  nativeTheme.themeSource = 'light'
  console.log('theme', 'light')
  return {
    content: [{ type: 'text', text: `テーマを「light」に変更しました。` }],
  }
})
