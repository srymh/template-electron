import { fs } from '@your-app-name/api/renderer'

import {
  CHAT_ATTACHMENT_EXTENSIONS,
  isAllowedChatAttachment,
} from '@/features/chat/hooks/use-chat-attachment'
import type { ChatAttachmentLoadResult } from '@/features/chat/hooks/use-chat-attachment'

export type LoadChatAttachmentFromFileSystemOptions = {
  title?: string
  message?: string
}

export async function loadChatAttachmentFromFileSystem(
  options: LoadChatAttachmentFromFileSystemOptions = {},
): Promise<ChatAttachmentLoadResult> {
  const { title = '添付ファイルを選択', message = '添付ファイルを選択してください' } = options
  const result = await fs.showOpenDialog({
    title,
    message,
    filters: [{ name: 'Text Files', extensions: [...CHAT_ATTACHMENT_EXTENSIONS] }],
    properties: ['openFile'],
  })

  if (result.canceled || result.filePaths.length === 0) {
    return { status: 'canceled' }
  }

  const filePath = result.filePaths[0]
  if (!filePath) {
    return { status: 'canceled' }
  }

  try {
    const details = await fs.getFileDetails({ path: filePath })

    if (!isAllowedChatAttachment(details)) {
      return { status: 'invalid' }
    }

    const content = await fs.readFileAsText({ path: filePath })

    return {
      status: 'selected',
      attachment: {
        name: details.name,
        size: details.size,
        content,
      },
    }
  } catch {
    console.error(`${new Date().toISOString()} Failed to read attachment file`)
    return { status: 'failed' }
  }
}
