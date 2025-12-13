# Wand - All-Purpose AI Assistant

Wand is an AI assistant application built with an architecture similar to Cursor, but designed for general-purpose tasks beyond just coding.

## Architecture

- **Frontend**: React + TypeScript + Tailwind CSS (Renderer Process)
- **Backend**: Electron + Node.js (Main Process)
- **AI Service**: Integrated module in the Main Process (simulated connection to LLMs)

## Project Structure

- `src/main`: Main process code (Window management, AI Service, IPC)
- `src/preload`: Preload scripts for secure IPC communication
- `src/renderer`: React application (UI)
  - `components/ChatInterface.tsx`: The AI chat interface (Cursor-like)
  - `components/Sidebar.tsx`: Navigation
  - `components/WorkspaceView.tsx`: Main content area

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run in development mode:
   ```bash
   npm run dev
   ```

3. Build for production:
   ```bash
   npm run build
   ```
