import { ipcMain, dialog } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';

export class FileService {
  constructor() {
    this.setupHandlers();
  }

  private setupHandlers() {
    ipcMain.handle('dialog:openDirectory', async () => {
      const { canceled, filePaths } = await dialog.showOpenDialog({
        properties: ['openDirectory']
      });
      if (canceled) {
        return null;
      }
      return filePaths[0];
    });

    ipcMain.handle('dialog:openFile', async () => {
      const { canceled, filePaths } = await dialog.showOpenDialog({
        properties: ['openFile']
      });
      if (canceled) {
        return null;
      }
      return filePaths[0];
    });

    ipcMain.handle('dialog:showSaveDialog', async () => {
      const { canceled, filePath } = await dialog.showSaveDialog({
        properties: ['showOverwriteConfirmation', 'createDirectory']
      });
      if (canceled) {
        return null;
      }
      return filePath;
    });

    ipcMain.handle('fs:saveFile', async (_, filePath: string, content: string) => {
      try {
        await fs.writeFile(filePath, content, 'utf-8');
        return true;
      } catch (error) {
        console.error('Error saving file:', error);
        throw error;
      }
    });

    ipcMain.handle('fs:readDirectory', async (_, dirPath: string) => {
      try {
        const dirents = await fs.readdir(dirPath, { withFileTypes: true });
        return dirents.map(dirent => ({
          name: dirent.name,
          isDirectory: dirent.isDirectory(),
          path: path.join(dirPath, dirent.name)
        })).sort((a, b) => {
          // Folders first
          if (a.isDirectory === b.isDirectory) {
            return a.name.localeCompare(b.name);
          }
          return a.isDirectory ? -1 : 1;
        });
      } catch (error) {
        console.error('Error reading directory:', error);
        return [];
      }
    });

    ipcMain.handle('fs:readFile', async (_, filePath: string) => {
      try {
        const stats = await fs.stat(filePath);
        
        // Limit to 100MB to prevent OOM
        if (stats.size > 100 * 1024 * 1024) {
          throw new Error('File is too large (max 100MB)');
        }

        const buffer = await fs.readFile(filePath);
        
        // Check for binary content (null bytes in first 1024 bytes)
        const isBinary = buffer.subarray(0, Math.min(1024, buffer.length)).includes(0);

        if (filePath.toLowerCase().endsWith('.pdf')) {
           return `data:application/pdf;base64,${buffer.toString('base64')}`;
        }

        if (isBinary) {
          // Return as base64 data URI for binary files
          return `data:application/octet-stream;base64,${buffer.toString('base64')}`;
        }

        return buffer.toString('utf-8');
      } catch (error) {
        console.error('Error reading file:', error);
        throw error;
      }
    });
  }
}
