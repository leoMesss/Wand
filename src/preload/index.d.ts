import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      chat: (message: string, config?: any) => Promise<string>
      fetchModels: (config: any) => Promise<any>
      chatStream: (message: string, history: any[], config: any, onChunk: (chunk: string) => void, onDone: () => void, onError: (error: string) => void) => () => void
      chatStop: () => void
      openDirectory: () => Promise<string | null>
      openFile: () => Promise<string | null>
      showSaveDialog: () => Promise<string | null>
      readDirectory: (path: string) => Promise<Array<{ name: string; isDirectory: boolean; path: string }>>
      readFile: (path: string) => Promise<string>
      saveFile: (path: string, content: string) => Promise<void>
      createDirectory: (path: string) => Promise<boolean>
      delete: (path: string) => Promise<boolean>
      rename: (oldPath: string, newPath: string) => Promise<boolean>
      revealInExplorer: (path: string) => Promise<void>
      copyFile: (source: string, dest: string) => Promise<boolean>
      exists: (path: string) => Promise<boolean>
      showOpenDialog: () => Promise<{ canceled: boolean; filePaths: string[] }>
      clearTempTools: () => Promise<any>
      saveTool: (name: string, code: string, description: string) => Promise<any>
    }
  }
}
