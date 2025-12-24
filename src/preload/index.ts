import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  chat: (message: string, config?: any) => ipcRenderer.invoke('ai:chat', message, config),
  fetchModels: (config: any) => ipcRenderer.invoke('ai:fetch-models', config),
  chatStream: (message: string, history: any[], config: any, onChunk: (chunk: string) => void, onDone: () => void, onError: (error: string) => void) => {
    ipcRenderer.send('ai:chat-stream', { message, history, config });
    
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
  chatStop: () => ipcRenderer.send('ai:chat-stop'),
  openDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  showSaveDialog: () => ipcRenderer.invoke('dialog:showSaveDialog'),
  readDirectory: (path: string) => ipcRenderer.invoke('fs:readDirectory', path),
  readFile: (path: string) => ipcRenderer.invoke('fs:readFile', path),
  saveFile: (path: string, content: string) => ipcRenderer.invoke('fs:saveFile', path, content),
  createDirectory: (path: string) => ipcRenderer.invoke('fs:createDirectory', path),
  delete: (path: string) => ipcRenderer.invoke('fs:delete', path),
  rename: (oldPath: string, newPath: string) => ipcRenderer.invoke('fs:rename', oldPath, newPath),
  revealInExplorer: (path: string) => ipcRenderer.invoke('fs:revealInExplorer', path),
  copyFile: (source: string, dest: string) => ipcRenderer.invoke('fs:copyFile', source, dest),
  exists: (path: string) => ipcRenderer.invoke('fs:exists', path),
  showOpenDialog: () => ipcRenderer.invoke('dialog:showOpenDialog'),
  clearTempTools: () => ipcRenderer.invoke('ai:clear-temp-tools'),
  saveTool: (name: string, code: string, description: string) => ipcRenderer.invoke('ai:save-tool', name, code, description)
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
