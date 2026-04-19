import { nativeTheme } from 'electron'

import { retrieveRagContext, type RetrieveRagContextOptions } from '#/shared/lib/rag/retrieve'

import {
  switchThemeDarkToolDef,
  switchThemeLightToolDef,
  searchProjectDetailToolDef,
} from './definitions'

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

export function createSearchProjectDetailTool(options: RetrieveRagContextOptions) {
  const { dbPath, docName, model, queryPrefix, topK } = options
  return searchProjectDetailToolDef.server(async ({ question }) => {
    const context = await retrieveRagContext(question, {
      dbPath,
      docName,
      model,
      queryPrefix,
      topK,
    })
    return { context }
  })
}
