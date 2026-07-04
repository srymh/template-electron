import type { ThinkingPart } from '@tanstack/ai-client'

import { ExpandableSection } from '../utils/expandable-section'

export function ThinkingContent({ part }: { part: ThinkingPart }) {
  return <ExpandableSection title="Thinking">{part.content}</ExpandableSection>
}
