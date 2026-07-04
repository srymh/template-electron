import type { ToolResultPart } from '@tanstack/ai'

import { ExpandableSection } from '../utils/expandable-section'
import { ParameterDisplay } from '../utils/parameter-display'

export function ToolResultContent({ part }: { part: ToolResultPart }) {
  return (
    <ExpandableSection title={`Tool Result${part.error ? ' (Error)' : ''}`}>
      {/* <pre className="font-mono not-italic">{JSON.stringify(part, null, 2)}</pre> */}
      <ParameterDisplay
        rows={[
          {
            label: 'content',
            value:
              typeof part.content === 'string'
                ? part.content
                : JSON.stringify(part.content, null, 2),
          },
          { label: 'state', value: JSON.stringify(part.state, null, 2) },
          ...(part.error ? [{ label: 'error', value: JSON.stringify(part.error, null, 2) }] : []),
        ]}
      />
    </ExpandableSection>
  )
}
