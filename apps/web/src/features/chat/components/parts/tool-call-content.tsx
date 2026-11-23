import type { ToolApprovalInterrupt, ToolCallPart } from '@tanstack/ai-client'

import { Button } from '@repo/ui/components/button'

import { ExpandableSection } from '../utils/expandable-section'
import { ParameterDisplay } from '../utils/parameter-display'

type ApprovalInterrupt = Pick<ToolApprovalInterrupt, 'canResolve' | 'status' | 'errors'> & {
  resolveInterrupt: (approved: boolean) => void
}

/** ツールの引数・結果を表示し、対応する Interrupt の承認・拒否を行う。 */
export function ToolCallContent({
  part,
  approval,
  resuming = false,
}: {
  part: ToolCallPart
  approval?: ApprovalInterrupt
  resuming?: boolean
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
          <div className="border-border flex flex-col gap-2 rounded-md border p-2">
            <div>
              <p className="text-muted-foreground text-sm">
                このツール（{part.name}
                ）呼び出しは、実行する前に承認が必要です。上記の詳細を確認し、リクエストを承認または拒否することを選択してください。
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="default"
                disabled={
                  !approval?.canResolve ||
                  !['pending', 'error'].includes(approval.status) ||
                  resuming
                }
                onClick={() => approval?.resolveInterrupt(true)}
              >
                承認
              </Button>
              <Button
                variant="destructive"
                disabled={
                  !approval?.canResolve ||
                  !['pending', 'error'].includes(approval.status) ||
                  resuming
                }
                onClick={() => approval?.resolveInterrupt(false)}
              >
                拒否
              </Button>
            </div>
          </div>{' '}
          {approval?.errors.map((error, index) => (
            <p key={index} role="alert" className="text-destructive text-sm">
              {error.message}
            </p>
          ))}
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
