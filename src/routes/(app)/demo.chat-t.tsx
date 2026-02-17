import { createFileRoute } from '@tanstack/react-router'
import { Chat } from '@/features/chat/components/chat'

export const Route = createFileRoute('/(app)/demo/chat-t')({
  component: RouteComponent,
  loader: () => ({ crumb: 'AIチャット(TanStack AI)' }),
})

function RouteComponent() {
  return (
    <div>
      <Chat />
    </div>
  )
}
