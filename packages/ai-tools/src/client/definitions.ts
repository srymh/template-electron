import { toolDefinition } from '@tanstack/ai'
import { z } from 'zod'

export const clockToolDef = toolDefinition({
  name: 'clock',
  description: 'Get the current time.',
  inputSchema: z.object({}),
  outputSchema: z.object({
    time: z.string(),
  }),
})
