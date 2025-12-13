import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  chat: (message: string, config?: any) => ipcRenderer.invoke('ai:chat', message, config),
  chatStream: (message: string, config: any, onChunk: (chunk: string) => void, onDone: () => void, onError: (error: string) => void) => {
    ipcRenderer.send('ai:chat-stream', { message, config });
    
    const chunkHandler = (_: any, chunk: string) => onChunk(chunk);
    const doneHandler = () => {
      cleanup();
      onDone();
    };
    const errorHandler = (_: any, error: string) => {
      cleanup();
      onError(error);
    };

    const cleanup = () => {
      ipcRenderer.removeListener('ai:chat-chunk', chunkHandler);
      ipcRenderer.removeListener('ai:chat-done', doneHandler);
      ipcRenderer.removeListener('ai:chat-error', errorHandler);
    };

    ipcRenderer.on('ai:chat-chunk', chunkHandler);
    ipcRenderer.on('ai:chat-done', doneHandler);
    ipcRenderer.on('ai:chat-error', errorHandler);

    return cleanup; // Return cleanup function if needed
  },
  openDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  showSaveDialog: () => ipcRenderer.invoke('dialog:showSaveDialog'),
  readDirectory: (path: string) => ipcRenderer.invoke('fs:readDirectory', path),
  readFile: (path: string) => ipcRenderer.invoke('fs:readFile', path),
  saveFile: (path: string, content: string) => ipcRenderer.invoke('fs:saveFile', path, content)
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
