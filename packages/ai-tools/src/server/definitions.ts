import { toolDefinition } from '@tanstack/ai'

export const switchThemeDarkToolDef = toolDefinition({
  name: 'switch_theme_dark',
  description: "Change the application's theme to dark.",
})

export const switchThemeLightToolDef = toolDefinition({
  name: 'switch_theme_light',
  description: "Change the application's theme to light.",
})
