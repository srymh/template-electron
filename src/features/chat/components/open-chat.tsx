import * as React from 'react'
import { BotIcon, XIcon } from 'lucide-react'
import type { Model } from '#/main/features/chat/ollama/models'
import { MODELS, modelSchema } from '#/main/features/chat/ollama/models'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Chat } from '@/features/chat/components/chat'
import { ChatSessionProvider } from '@/features/chat/components/chat-session-provider'
import { Button } from '@/components/ui/button'

export function OpenChat() {
  const [selectedModel, setSelectedModel] =
    React.useState<Model>('gpt-oss:20b-cloud')

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <ChatSessionProvider model={selectedModel}>
          <Dialog modal={false}>
            <DialogTrigger asChild>
              <SidebarMenuButton
                variant="outline"
                className="bg-sidebar text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              >
                <BotIcon />
                <span>AIチャット</span>
              </SidebarMenuButton>
            </DialogTrigger>

            <DialogContent
              showCloseButton={false}
              className="top-[calc(var(--header-height)+var(--spacing,0.25rem)*2)] left-auto right-4 max-h-[calc(100vh-5rem)] translate-x-0 translate-y-0 overflow-hidden flex flex-col sm:max-w-md border border-primary shadow-lg shadow-primary/30 hover:shadow-primary/50"
              // ダイアログ外クリックで閉じないようにする
              onInteractOutside={(e) => e.preventDefault()}
              // ダイアログ外クリックで閉じないようにする
              onPointerDownOutside={(e) => e.preventDefault()}
              // ESC キーで閉じないようにする
              onEscapeKeyDown={(e) => e.preventDefault()}
            >
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between">
                  <div className="flex items-center justify-start text-lg font-semibold gap-1">
                    <BotIcon />
                    <span>AIチャット</span>
                  </div>
                  <div className="flex items-center justify-end  gap-1">
                    <Select
                      onValueChange={(value) =>
                        setSelectedModel(modelSchema.parse(value))
                      }
                      value={selectedModel}
                    >
                      <SelectTrigger>
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
                    <DialogClose asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="hover:text-destructive"
                      >
                        <XIcon />
                      </Button>
                    </DialogClose>
                  </div>
                </DialogTitle>
              </DialogHeader>
              <Chat />
            </DialogContent>
          </Dialog>
        </ChatSessionProvider>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
