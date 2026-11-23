import { useRef, useState } from 'react'

import { useForm } from '@tanstack/react-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Trash2Icon } from 'lucide-react'

import { TodoCreateInputSchema } from '@repo/todo'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@repo/ui/components/alert-dialog'
import { Button } from '@repo/ui/components/button'
import { Checkbox } from '@repo/ui/components/checkbox'
import { Field, FieldContent, FieldError } from '@repo/ui/components/field'
import { Input } from '@repo/ui/components/input'
import { Separator } from '@repo/ui/components/separator'
import { todo } from '@your-app-name/api/renderer'

export const Route = createFileRoute('/(app)/todo')({
  component: RouteComponent,
  loader: () => ({ crumb: 'やること' }),
})

/** Todo の追加、完了状態の切り替え、確認付き削除を提供する。 */
function RouteComponent() {
  const [removalTargetId, setRemovalTargetId] = useState<string | null>(null)
  const { data, isLoading, error } = useQuery({
    queryKey: ['todos'],
    queryFn: () => todo.list(),
  })

  const queryClient = useQueryClient()
  const createMutation = useMutation({
    mutationFn: (input: Parameters<typeof todo.create>[0]) => todo.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todos'] })
    },
  })

  const titleInputRef = useRef<HTMLInputElement>(null)
  const form = useForm({
    defaultValues: {
      title: '',
    },
    onSubmit: async ({ value }) => {
      await createMutation.mutateAsync({
        input: {
          title: value.title,
        },
      })
      form.reset()
      titleInputRef.current?.focus()
    },
  })

  const removeMutation = useMutation({
    mutationFn: (id: string) => todo.remove({ id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todos'] })
    },
  })
  const setCompletedMutation = useMutation({
    mutationFn: ({ id, completed }: { id: string; completed: boolean }) =>
      todo.setCompleted({ id, completed }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todos'] })
    },
  })

  if (isLoading) return <div>Loading...</div>
  if (error) return <div>Error: {error.message}</div>

  return (
    <div className="bg-background text-foreground h-full w-full bg-[url('/hero-bg-1_pc.png')]">
      <div className="bg-background/30 h-full w-full overflow-auto backdrop-blur-xs">
        <div className="mx-auto w-full max-w-3xl p-4 md:p-6">
          <h1 className="text-xl font-semibold tracking-tight">やることリスト</h1>

          <Separator className="my-3" />

          <div className="space-y-2">
            <h2 className="text-muted-foreground text-sm font-medium">やることを追加</h2>
            <form
              className="flex items-start gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                e.stopPropagation()
                void form.handleSubmit()
              }}
            >
              <form.Field
                name="title"
                validators={{
                  onSubmit: TodoCreateInputSchema.shape.title,
                }}
              >
                {(field) => (
                  <Field className="flex-1">
                    <FieldContent>
                      <Input
                        ref={titleInputRef}
                        id={field.name}
                        type="text"
                        placeholder="新しくやること..."
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        aria-label="新しくやること"
                        aria-invalid={field.state.meta.errors.length > 0}
                        data-invalid={field.state.meta.errors.length > 0}
                      />
                    </FieldContent>
                    <FieldError
                      className="text-destructive mt-1 text-sm"
                      errors={field.state.meta.errors.map((err) => {
                        if (!err) return undefined
                        if (typeof err === 'string') return { message: err }
                        if (typeof err === 'object' && 'message' in err) {
                          const message = (err as { message?: unknown }).message
                          return typeof message === 'string' ? { message } : undefined
                        }
                        return undefined
                      })}
                    />
                  </Field>
                )}
              </form.Field>

              <form.Subscribe selector={(state) => state.isSubmitting}>
                {(isSubmitting) => (
                  <Button type="submit" disabled={isSubmitting}>
                    追加
                  </Button>
                )}
              </form.Subscribe>
            </form>
          </div>

          <Separator className="my-4" />

          <div className="border-border bg-background/50 overflow-hidden rounded-md border">
            {data!.map((item) => (
              <div
                key={item.id}
                className="hover:bg-muted/50 flex items-center justify-between gap-2 px-3 py-2 transition-colors"
              >
                <div className="flex min-w-0 flex-1 items-start gap-2">
                  <Checkbox
                    id={`todo-${item.id}`}
                    className="mt-0.5 cursor-pointer"
                    checked={item.completed}
                    onCheckedChange={(checked) => {
                      setCompletedMutation.mutate({
                        id: item.id,
                        completed: checked,
                      })
                    }}
                  />
                  <label
                    htmlFor={`todo-${item.id}`}
                    className={
                      'min-w-0 flex-1 cursor-pointer text-sm leading-snug wrap-break-word ' +
                      (item.completed ? 'text-muted-foreground line-through' : '')
                    }
                  >
                    {item.title}
                  </label>
                </div>
                <AlertDialog
                  open={removalTargetId === item.id}
                  onOpenChange={(open) => setRemovalTargetId(open ? item.id : null)}
                >
                  <AlertDialogTrigger
                    render={<Button variant="destructive" size="icon-xs" aria-label="削除" />}
                  >
                    <Trash2Icon className="size-4" />
                  </AlertDialogTrigger>
                  <AlertDialogContent size="sm">
                    <AlertDialogHeader>
                      <AlertDialogMedia className="bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-destructive">
                        <Trash2Icon />
                      </AlertDialogMedia>
                      <AlertDialogTitle>このやることを削除しますか？</AlertDialogTitle>
                      <AlertDialogDescription>
                        この操作は取り消せません。本当に削除してもよろしいですか？
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel variant="ghost">キャンセル</AlertDialogCancel>
                      <AlertDialogAction
                        variant="destructive"
                        onClick={() => {
                          setRemovalTargetId(null)
                          removeMutation.mutate(item.id)
                        }}
                      >
                        削除
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
