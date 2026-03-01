import { toolDefinition } from '@tanstack/ai'
import { z } from 'zod'

export const switchThemeDarkToolDef = toolDefinition({
  name: 'switch_theme_dark',
  description: "Change the application's theme to dark.",
})

export const switchThemeLightToolDef = toolDefinition({
  name: 'switch_theme_light',
  description: "Change the application's theme to light.",
})

export const searchProjectDetailToolDef = toolDefinition({
  name: 'search_project_detail',
  description: "Search the project's documentation based on a question.",
  inputSchema: z.object({ question: z.string() }),
  outputSchema: z.object({
    context: z.array(
      z.object({
        docName: z.string(),
        sourceChunkIdx: z.number(),
        subIdx: z.number(),
        content: z.string(),
        score: z.number(),
      }),
    ),
  }),
})
