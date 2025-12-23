import sys
import json
import os
from api_client import fetch_available_models
from llm_processor import LLMProcessor
from tools import get_tools_definitions
from ShareMemory.P10_config import P10Config

# Set encoding to utf-8 for stdin/stdout/stderr to handle Chinese characters correctly
sys.stdin.reconfigure(encoding='utf-8')
sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8', errors='replace')

# Set working directory to project root (2 levels up from src/backend)
# This ensures that file operations performed by tools default to the workspace root
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(os.path.dirname(current_dir))
if os.path.exists(project_root):
    os.chdir(project_root)

def main():
    try:
        # Read all input from stdin
        input_str = sys.stdin.read()
        if not input_str:
            return

        request_data = json.loads(input_str)
        command_type = request_data.get('type', 'chat') # Default to chat
        config = request_data.get('config', {})
        
        # 0. Set Workspace Path if provided
        workspace_path = config.get('workspacePath')
        if workspace_path and os.path.exists(workspace_path):
            os.chdir(workspace_path)
        
        # 1. Extract Configuration
        api_key = config.get('apiKey')
        base_url = config.get('baseUrl')

        if command_type == 'clear_temp_tools':
            from tools import clear_temporary_tools
            result = clear_temporary_tools()
            print(json.dumps({'status': 'success', 'message': result}))
            return

        if command_type == 'save_tool':
            from tools import save_tool
            tool_data = request_data.get('tool_data', {})
            result = save_tool(tool_data.get('name'), tool_data.get('code'), tool_data.get('description'))
            print(json.dumps({'status': 'success', 'message': result}))
            return

        if command_type == 'get_tools':
            tools = get_tools_definitions()
            print(json.dumps({'tools': tools}))
            return

        if not api_key:
            print(json.dumps({'error': 'Missing API Key. Please configure it in settings.'}))
            return

        if command_type == 'fetch_models':
            result = fetch_available_models(api_key, base_url)
            print(json.dumps(result))
            return

        message = request_data.get('message')
        history = request_data.get('history', [])

        # 4. Process with LLM
        processor = LLMProcessor(config)
        
        # Use user-attached files if any
        selected_files = config.get('files', [])
        
        stream = processor.process(message, history, selected_files)

        # 5. Output the result as JSON chunks with parsing
        buffer = ""
        state = "NORMAL" # NORMAL, THINKING, TOOL
        
        def print_chunk(text):
            print(json.dumps({'chunk': text}, ensure_ascii=False))
            sys.stdout.flush()

        for chunk in stream:
            content = chunk.choices[0].delta.content
            if not content: continue
            
            buffer += content
            
            while True:
                if state == "NORMAL":
                    # Check for <thinking>
                    if "<thinking>" in buffer:
                        pre, post = buffer.split("<thinking>", 1)
                        if pre: print_chunk(pre)
                        print_chunk("<thinking>")
                        state = "THINKING"
                        buffer = post
                        continue
                    
                    # Check for <tool>
                    if "<tool>" in buffer:
                        pre, post = buffer.split("<tool>", 1)
                        if pre: print_chunk(pre)
                        print_chunk("<tool>")
                        state = "TOOL"
                        buffer = post
                        continue
                    
                    # Flush buffer if safe
                    if len(buffer) > 20 and "<" not in buffer:
                        print_chunk(buffer)
                        buffer = ""
                    elif len(buffer) > 100: # Force flush if too long
                        print_chunk(buffer)
                        buffer = ""
                    break

                elif state == "THINKING":
                    if "</thinking>" in buffer:
                        pre, post = buffer.split("</thinking>", 1)
                        if pre: print_chunk(pre)
                        print_chunk("</thinking>")
                        state = "NORMAL"
                        buffer = post
                        continue
                    
                    # Safe flush: Don't flush if buffer ends with partial tag
                    last_open = buffer.rfind("<")
                    if last_open != -1 and len(buffer) - last_open < 20:
                        to_print = buffer[:last_open]
                        buffer = buffer[last_open:]
                        if to_print: print_chunk(to_print)
                    else:
                        print_chunk(buffer)
                        buffer = ""
                    break

                elif state == "TOOL":
                    if "</tool>" in buffer:
                        pre, post = buffer.split("</tool>", 1)
                        if pre: print_chunk(pre)
                        print_chunk("</tool>")
                        state = "NORMAL"
                        buffer = post
                        continue
                    
                    # Safe flush: Don't flush if buffer ends with partial tag
                    last_open = buffer.rfind("<")
                    if last_open != -1 and len(buffer) - last_open < 20:
                        to_print = buffer[:last_open]
                        buffer = buffer[last_open:]
                        if to_print: print_chunk(to_print)
                    else:
                        print_chunk(buffer)
                        buffer = ""
                    break
        
        # Flush remaining buffer
        if buffer:
            print_chunk(buffer)

    except Exception as e:
        # Output error as JSON
        print(json.dumps({'error': str(e)}, ensure_ascii=False))
        sys.stdout.flush()

if __name__ == '__main__':
    main()
