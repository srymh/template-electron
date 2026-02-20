import type {
  ConstrainedModelMessage,
  InputModalitiesTypes,
  ModelMessage,
} from '@tanstack/ai'

export type OllamaInputModalities = readonly ['text', 'image']
export type OllamaModelMessage = ConstrainedModelMessage<
  InputModalitiesTypes & {
    inputModalities: OllamaInputModalities
  }
>

export function isOllamaModelMessage(
  message: ModelMessage,
): message is OllamaModelMessage {
  if (typeof message.content === 'string' || message.content === null) {
    return true
  }
  if (message.content.every((x) => x.type === 'text' || x.type === 'image')) {
    return true
  }
  return false
}
