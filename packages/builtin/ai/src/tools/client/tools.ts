import { clockToolDef } from './definitions'

export const clockTool = clockToolDef.client(() => {
  const now = new Date()
  return {
    time: now.toLocaleString(),
  }
})
