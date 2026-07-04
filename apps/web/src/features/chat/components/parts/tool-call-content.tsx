import type { ToolCallPart } from '@tanstack/ai-client'

import { ExpandableSection } from '../utils/expandable-section'
import { ParameterDisplay } from '../utils/parameter-display'

export function ToolCallContent({ part }: { part: ToolCallPart }) {
  switch (part.state) {
    case 'awaiting-input':
      return (
        <ExpandableSection title={`Tool Call: ${part.name} (Awaiting Input)`}>
          <pre className="font-mono not-italic">{JSON.stringify(part, null, 2)}</pre>
        </ExpandableSection>
      )
    case 'input-streaming':
      return (
        <ExpandableSection title={`Tool Call: ${part.name} (Input Streaming)`}>
          <pre className="font-mono not-italic">{JSON.stringify(part, null, 2)}</pre>
        </ExpandableSection>
      )
    case 'input-complete':
      return (
        <ExpandableSection title={`Tool Call: ${part.name} (Input Complete)`}>
          <pre className="font-mono not-italic">{JSON.stringify(part, null, 2)}</pre>
        </ExpandableSection>
      )
    case 'approval-requested':
      return (
        <ExpandableSection title={`Tool Call: ${part.name} (Approval Requested)`}>
          <pre className="font-mono not-italic">{JSON.stringify(part, null, 2)}</pre>
        </ExpandableSection>
      )
    case 'approval-responded':
      return (
        <ExpandableSection title={`Tool Call: ${part.name} (Approval Responded)`}>
          <pre className="font-mono not-italic">{JSON.stringify(part, null, 2)}</pre>
        </ExpandableSection>
      )
    case 'complete':
      return (
        <ExpandableSection title={`Tool Call: ${part.name} (Complete)`}>
          {/* <pre className="font-mono not-italic">{JSON.stringify(part, null, 2)}</pre> */}
          <ParameterDisplay
            rows={[
              { label: 'name', value: JSON.stringify(part.name, null, 2) },
              { label: 'state', value: JSON.stringify(part.state, null, 2) },
              {
                label: 'arguments',
                value: formatToolArguments(part.arguments),
              },
              { label: 'output', value: JSON.stringify(part.output, null, 2) },
            ]}
          />
        </ExpandableSection>
      )
    case 'error':
      return (
        <ExpandableSection title={`Tool Call: ${part.name} (Error)`}>
          {/* <pre className="font-mono not-italic">{JSON.stringify(part, null, 2)}</pre> */}
          <ParameterDisplay
            rows={[
              { label: 'name', value: JSON.stringify(part.name, null, 2) },
              { label: 'state', value: JSON.stringify(part.state, null, 2) },
              {
                label: 'arguments',
                value: formatToolArguments(part.arguments),
              },
              { label: 'output', value: JSON.stringify(part.output, null, 2) },
            ]}
          />
        </ExpandableSection>
      )
    default:
      return <div>Not Implemented: tool-call: UNKNOWN</div>
  }
}

function formatToolArguments(toolArguments: string) {
  try {
    return JSON.stringify(JSON.parse(toolArguments), null, 2)
  } catch {
    return toolArguments
  }
}
