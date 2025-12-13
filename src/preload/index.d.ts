import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      chat: (message: string) => Promise<string>
      openDirectory: () => Promise<string | null>
      readDirectory: (path: string) => Promise<Array<{ name: string; isDirectory: boolean; path: string }>>
      readFile: (path: string) => Promise<string>
    }
  }
}
