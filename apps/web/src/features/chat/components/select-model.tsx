import { MODELS, modelSchema } from '@repo/ai/shared'
import type { Model } from '@repo/ai/shared'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui/components/select'

/** 利用可能なチャットモデルを表示し、検証済みの選択値を親へ通知する。 */
export function SelectModel({
  selectedModel,
  setSelectedModel,
}: {
  selectedModel: Model
  setSelectedModel: (model: Model) => void
}) {
  return (
    <Select
      onValueChange={(value) => {
        if (value !== null) setSelectedModel(modelSchema.parse(value))
      }}
      value={selectedModel}
    >
      <SelectTrigger className="max-w-48" size="sm">
        <SelectValue placeholder="モデル選択" />
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false}>
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
