# 🪄 Wand - 您的全能 AI 智能助手

![Wand Banner](https://via.placeholder.com/1200x300/1e1e1e/ffffff?text=Wand+AI+Assistant)

> **Wand** 是一个基于 Electron 和 React 构建的现代化 AI 助手应用。它不仅仅是一个聊天机器人，更是一个**以工具为核心 (Tool-Oriented)** 的智能工作台。Wand 赋予了 AI 自动创建工具、执行工具的能力，并支持用户高度自定义专属工具，无限扩展 AI 的能力边界。

<div align="center">

![Electron](https://img.shields.io/badge/Electron-28.1.0-47848F?style=flat-square&logo=electron&logoColor=white)
![React](https://img.shields.io/badge/React-18.2.0-61DAFB?style=flat-square&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.3.3-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Python](https://img.shields.io/badge/Python-Backend-3776AB?style=flat-square&logo=python&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4.0-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)

</div>

---

## ✨ 核心特性

### 🛠️ 面向工具的架构 (Tool-Oriented)
Wand 的核心理念是"工具即能力"。我们提供了一套完整的生命周期管理系统，让 AI 能够自我进化：
- **自动工具创建**：AI 可以根据您的自然语言需求，自动编写 Python 代码并注册为新工具，即刻可用。
- **用户自定义扩展**：通过内置的可视化编辑器，您可以轻松编写、调试和保存自己的 Python 工具函数。
- **可视化管理**：
  - **权限分级**：从 P5 (只读) 到 P10 (系统控制)，精确管控每个工具的安全级别。
  - **实时编辑**：直接在 UI 中修改工具代码、描述和元数据，支持热重载。
  - **安全验证**：自动检查 Python 语法和函数签名，防止错误代码运行。
  - **智能扫描**：内置 `scan_workspace` 和 `get_workspace_content_index` 工具，支持 `.gitignore` 和智能折叠，高效处理大型项目上下文。

### 🤖 沉浸式 AI 对话
- **多模型支持**：无缝切换 SiliconFlow (DeepSeek), 阿里云百炼, OpenAI 等多种大模型服务。
- **流式响应**：体验流畅的打字机效果，实时获取 AI 回复。
- **思维链可视化**：独创的 `<thinking>` 折叠块，让 AI 的思考过程透明化，支持自动折叠与展开。
- **Debug 模式**：内置调试工具，可查看原始消息 JSON，方便开发者调试 Prompt。

### 📝 全能编辑器与查看器
- **多格式支持**：
  - **Markdown**：支持实时预览与源码编辑切换。
  - **PDF**：内置高性能 PDF 阅读器。
  - **HTML**：支持 HTML 文件渲染预览。
  - **代码文件**：支持多种编程语言的语法高亮编辑。
- **标签页管理**：像 IDE 一样管理多个打开的文件。

### ⚡ 强大的后端架构
- **Python 驱动**：利用 Python 强大的生态系统处理复杂任务（文件 I/O, 系统调用, 数据分析）。
- **IPC 通信**：Electron 前端与 Python 后端通过标准输入输出 (Stdio) 进行高效通信。
- **热重载**：开发模式下支持后端代码热更新。
- **配置分离**：工具定义与配置独立存储 (`src/backend/configs/`)，便于管理与迁移。

---

## 🚀 快速开始

### 环境要求
- **Node.js**: v16+
- **Python**: v3.8+ (建议使用虚拟环境)
- **npm** 或 **yarn**

### 安装步骤

1. **克隆项目**
   ```bash
   git clone https://github.com/leoMesss/Wand.git
   cd Wand
   ```

2. **安装依赖**
   ```bash
   # 安装前端依赖
   npm install
   
   # 安装后端依赖 (建议在虚拟环境中)
   pip install -r src/backend/requirements.txt
   ```

3. **启动开发服务器**
   ```bash
   npm run dev
   ```

### 构建发布

打包应用程序（Windows）：
```bash
npm run pack:win
```

---

## 📂 项目结构

```
Wand/
├── src/
│   ├── main/           # Electron 主进程
│   ├── preload/        # 预加载脚本 (IPC 桥接)
│   ├── renderer/       # React 前端界面
│   │   ├── src/components/  # UI 组件 (ToolsModal, ChatInterface...)
│   │   └── ...
│   └── backend/        # Python 后端服务
│       ├── cli.py      # 入口点 & 命令路由
│       ├── tools.py    # 工具注册与管理逻辑       ├── configs/    # 配置文件目录
       │   ├── tools.json        # 工具定义
       │   └── tools_config.json # 工具可见性配置│       └── ...
├── electron.vite.config.ts  # 构建配置
└── package.json
```

## 🔧 配置说明

### 模型配置
在应用设置中，您可以配置不同的 LLM 提供商：
- **Base URL**: API 服务地址
- **API Key**: 您的认证密钥
- **Model ID**: 指定使用的模型（如 `deepseek-chat`）

### 工具权限 (Permission Levels)
- **P5**: 公共信息获取 (无副作用)
- **P6**: 工作区读取 (List/Read files)
- **P8**: 工作区写入 (Write/Delete files)
- **P10**: 系统控制 (高风险操作)

---

## 📄 许可证

[MIT License](LICENSE) © 2025 Wand Team
