import { ipcMain } from 'electron';
import { spawn } from 'child_process';
import path from 'path';

// This simulates the AI service that would connect to OpenAI/Anthropic/Local LLMs
export class AIService {
  constructor() {
    this.setupHandlers();
  }

  private setupHandlers() {
    ipcMain.on('ai:chat-stream', (event, { message, config }) => {
      this.processMessageStream(event, message, config);
    });
  }

  private processMessageStream(event: Electron.IpcMainEvent, message: string, config: any) {
    console.log('Processing AI request via Python CLI (Stream):', message);
    
    const scriptPath = path.join(process.cwd(), 'backend', 'cli.py');
    const pythonProcess = spawn('python', [scriptPath]);

    // Send data to Python script via stdin
    const inputData = JSON.stringify({ message, config });
    pythonProcess.stdin.write(inputData);
    pythonProcess.stdin.end();

    // Collect output from stdout
    pythonProcess.stdout.on('data', (data) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const result = JSON.parse(line);
          if (result.error) {
            event.reply('ai:chat-error', result.error);
          } else if (result.chunk) {
            event.reply('ai:chat-chunk', result.chunk);
          }
        } catch (e) {
          console.error('Failed to parse Python output chunk:', line);
        }
      }
    });

    // Collect error from stderr
    pythonProcess.stderr.on('data', (data) => {
      console.error('Python stderr:', data.toString());
    });

    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        event.reply('ai:chat-error', `Python script exited with code ${code}`);
      }
      event.reply('ai:chat-done');
    });

    pythonProcess.on('error', (err) => {
      event.reply('ai:chat-error', `Failed to start Python process: ${err.message}`);
    });
  }
}
