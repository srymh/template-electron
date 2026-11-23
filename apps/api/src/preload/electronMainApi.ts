import { createElectronApi } from '@repo/ipc/browser'

import type { ElectronMainApi } from '../api'

export const electronMainApi = createElectronApi<ElectronMainApi>(
  ({ defineHelper, useChannelAsInvoke, useChannelAsEvent }) =>
    /**
     * defineHelper の使用は任意ですが、以下の利点があります。
     * 1. 型推論を助けるために利用することができます。
     * 2. 誤ったチャネル名を使用した場合に型エラーを発生させることができます。
     */
    defineHelper({
      fs: {
        // 'this.should.cause.a.type.error': () => {},
        joinPath: useChannelAsInvoke('fs.joinPath'),
        readFileAsText: useChannelAsInvoke('fs.readFileAsText'),
        readFileAsArrayBuffer: useChannelAsInvoke('fs.readFileAsArrayBuffer'),
        writeFileAsText: useChannelAsInvoke('fs.writeFileAsText'),
        writeFileAsArrayBuffer: useChannelAsInvoke('fs.writeFileAsArrayBuffer'),
        showOpenDialog: useChannelAsInvoke('fs.showOpenDialog'),
        showSaveDialog: useChannelAsInvoke('fs.showSaveDialog'),
        readDirectory: useChannelAsInvoke('fs.readDirectory'),
        openFileByDefaultApp: useChannelAsInvoke('fs.openFileByDefaultApp'),
        getFileDetails: useChannelAsInvoke('fs.getFileDetails'),
        registerAppAssetDirectory: useChannelAsInvoke('fs.registerAppAssetDirectory'),
        unregisterAppAssetRoot: useChannelAsInvoke('fs.unregisterAppAssetRoot'),
        createAppAssetUrl: useChannelAsInvoke('fs.createAppAssetUrl'),
      },
      theme: {
        getTheme: useChannelAsInvoke('theme.getTheme'),
        setTheme: useChannelAsInvoke('theme.setTheme'),
        getAccentColor: useChannelAsInvoke('theme.getAccentColor'),
        on: {
          accentColorChanged: useChannelAsEvent('theme.on.accentColorChanged'),
          updated: useChannelAsEvent('theme.on.updated'),
        },
      },
      web: {
        findInPage: useChannelAsInvoke('web.findInPage'),
        stopFindInPage: useChannelAsInvoke('web.stopFindInPage'),
        on: {
          blur: useChannelAsEvent('web.on.blur'),
          focus: useChannelAsEvent('web.on.focus'),
          foundInPage: useChannelAsEvent('web.on.foundInPage'),
        },
      },
      aiChat: {
        chat: useChannelAsInvoke('aiChat.chat'),
        ingestDocument: useChannelAsInvoke('aiChat.ingestDocument'),
        on: {
          chunk: useChannelAsEvent('aiChat.on.chunk'),
        },
      },
      auth: {
        getStatus: useChannelAsInvoke('auth.getStatus'),
        login: useChannelAsInvoke('auth.login'),
        logout: useChannelAsInvoke('auth.logout'),
      },
      secret: {
        setSecret: useChannelAsInvoke('secret.setSecret'),
      },
      todo: {
        list: useChannelAsInvoke('todo.list'),
        get: useChannelAsInvoke('todo.get'),
        create: useChannelAsInvoke('todo.create'),
        update: useChannelAsInvoke('todo.update'),
        setCompleted: useChannelAsInvoke('todo.setCompleted'),
        remove: useChannelAsInvoke('todo.remove'),
      },
      storageDemo: {
        objects: {
          list: useChannelAsInvoke('storageDemo.objects.list'),
          put: useChannelAsInvoke('storageDemo.objects.put'),
          verify: useChannelAsInvoke('storageDemo.objects.verify'),
          remove: useChannelAsInvoke('storageDemo.objects.remove'),
        },
        tables: {
          list: useChannelAsInvoke('storageDemo.tables.list'),
          listRows: useChannelAsInvoke('storageDemo.tables.listRows'),
          createRow: useChannelAsInvoke('storageDemo.tables.createRow'),
          updateRow: useChannelAsInvoke('storageDemo.tables.updateRow'),
          removeRow: useChannelAsInvoke('storageDemo.tables.removeRow'),
        },
      },
    }),
  {
    // useChannelAsEvent を使ったイベント登録の管理用マップ
    registeredEventMap: new Map(),
  },
)
