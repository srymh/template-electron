import type { ToolCallPart } from '@tanstack/ai-client'

import { Button } from '@repo/ui/components/button'

import { ExpandableSection } from '../utils/expandable-section'
import { ParameterDisplay } from '../utils/parameter-display'

export function ToolCallContent({
  part,
  addToolApprovalResponse = () => {},
}: {
  part: ToolCallPart
  addToolApprovalResponse?: (response: { id: string; approved: boolean }) => void
}) {
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
        <>
          <ExpandableSection title={`Tool Call: ${part.name} (Approval Requested)`}>
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
          <div className="flex flex-col gap-2 p-2 border rounded-md border-border">
            <div>
              <p className="text-sm text-muted-foreground">
                このツール（{part.name}
                ）呼び出しは、実行する前に承認が必要です。上記の詳細を確認し、リクエストを承認または拒否することを選択してください。
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="default"
                onClick={() => addToolApprovalResponse({ id: part.approval!.id, approved: true })}
              >
                承認
              </Button>
              <Button
                variant="destructive"
                onClick={() => addToolApprovalResponse({ id: part.approval!.id, approved: false })}
              >
                拒否
              </Button>
            </div>
          </div>{' '}
        </>
      )
    case 'approval-responded':
      return (
        <ExpandableSection title={`Tool Call: ${part.name} (Approval Responded)`}>
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
