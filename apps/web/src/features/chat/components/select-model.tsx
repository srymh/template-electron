import { MODELS, modelSchema } from '@repo/ai-chat/shared'
import type { Model } from '@repo/ai-chat/shared'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui/components/select'

export function SelectModel({
  selectedModel,
  setSelectedModel,
}: {
  selectedModel: Model
  setSelectedModel: (model: Model) => void
}) {
  return (
    <Select
      onValueChange={(value) => setSelectedModel(modelSchema.parse(value))}
      value={selectedModel}
    >
      <SelectTrigger className="max-w-48" size="sm">
        <SelectValue placeholder="モデル選択" />
      </SelectTrigger>
      <SelectContent position="popper">
        <SelectGroup>
          {MODELS.map((model) => (
            <SelectItem key={model} value={model}>
              {model}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
