import sys
import json
import os
from api_client import fetch_available_models
from llm_processor import LLMProcessor
from tools import get_tools_definitions

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
        workspace_path = config.get('workspacePath')

        # 4. Process with LLM
        processor = LLMProcessor(config)
        
        # Use user-attached files if any
        selected_files = config.get('files', [])
        
        # Determine model (simple fallback)
        model_id = config.get('standardTextModel') or 'gpt-4'
        
        stream = processor.process(message, history, selected_files, model_id)

        # 5. Output the result as JSON chunks with parsing
        buffer = ""
        code_buffer = ""
        state = "NORMAL" # NORMAL, THINKING, ACTION, EXECUTING, CHECKING_CODE
        
        def print_chunk(text):
            print(json.dumps({'chunk': text}, ensure_ascii=False))
            sys.stdout.flush()

        for chunk in stream:
            content = chunk.choices[0].delta.content
            if not content: continue
            
            buffer += content
            
            while True:
                if state == "NORMAL":
                    if "<thinking>" in buffer:
                        pre, post = buffer.split("<thinking>", 1)
                        if pre: print_chunk(pre)
                        print_chunk("<details><summary>思考过程</summary>\n<div style='color: #a1a1aa; font-style: italic;'>\n")
                        state = "THINKING"
                        buffer = post
                        continue
                    
                    if "<action>" in buffer:
                        pre, post = buffer.split("<action>", 1)
                        if pre: print_chunk(pre)
                        state = "ACTION"
                        buffer = post
                        continue
                    
                    # Support code block in NORMAL state (fallback if <action> is missing)
                    if "```python:interpreter" in buffer:
                        pre, post = buffer.split("```python:interpreter", 1)
                        if pre: print_chunk(pre)
                        # Don't print header yet. Switch to buffering state.
                        state = "CHECKING_CODE"
                        buffer = post
                        code_buffer = ""
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
                        # Explicitly close the box and add spacing to separate from Action text
                        print_chunk("</div>\n</details>\n\n")
                        state = "NORMAL"
                        buffer = post
                        continue
                    
                    # Robustness: If <action> appears but </thinking> is missing, force close thinking
                    if "<action>" in buffer:
                        pre, post = buffer.split("<action>", 1)
                        if pre: print_chunk(pre)
                        print_chunk("</div>\n</details>\n\n")
                        state = "ACTION"
                        buffer = post
                        continue

                    # Robustness: If code block appears but </thinking> is missing, force close thinking
                    if "```" in buffer:
                        pre, post = buffer.split("```", 1)
                        # Don't consume the backticks, just close the thinking block
                        # We need to re-process the buffer in NORMAL state to handle the code block
                        if pre: print_chunk(pre)
                        print_chunk("</div>\n</details>\n\n")
                        state = "NORMAL"
                        buffer = "```" + post
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
                
                elif state == "ACTION":
                    if "```python:interpreter" in buffer:
                        pre, post = buffer.split("```python:interpreter", 1)
                        if pre: print_chunk(pre)
                        # Don't print header yet. Switch to buffering state.
                        state = "CHECKING_CODE"
                        buffer = post
                        code_buffer = ""
                        continue
                    
                    if "</action>" in buffer:
                        pre, post = buffer.split("</action>", 1)
                        if pre:
                            # Filter out empty list artifact "[]" or "`[]`" which might be hallucinated by LLM on empty context
                            cleaned_pre = pre.strip()
                            if cleaned_pre != "[]" and cleaned_pre != "`[]`":
                                print_chunk(pre)
                        state = "NORMAL"
                        buffer = post
                        continue
                        
                    # Safe flush: Don't flush if buffer ends with partial tag or code block marker
                    # Check for < (end of action) or ` (start of code block)
                    last_tag = buffer.rfind("<")
                    last_tick = buffer.rfind("`")
                    last_open = max(last_tag, last_tick)
                    
                    if last_open != -1 and len(buffer) - last_open < 25:
                        to_print = buffer[:last_open]
                        buffer = buffer[last_open:]
                        if to_print: print_chunk(to_print)
                    else:
                        print_chunk(buffer)
                        buffer = ""
                    break
                
                elif state == "CHECKING_CODE":
                    # We are inside a code block, but haven't decided to show it yet.
                    # We need to check if there is any real code.
                    
                    # If we find closing backticks
                    if "```" in buffer:
                        code_content, remaining = buffer.split("```", 1)
                        full_code = code_buffer + code_content
                        
                        # Check if code is effectively empty (whitespace or only comments)
                        is_effectively_empty = True
                        if full_code.strip():
                            # Check if it has any non-comment lines
                            for line in full_code.split('\n'):
                                if line.strip() and not line.strip().startswith('#'):
                                    is_effectively_empty = False
                                    break
                        
                        if not is_effectively_empty:
                            # It has content!
                            print_chunk("<details open><summary>指令执行</summary>\n<pre><code class='language-python'>")
                            print_chunk(full_code)
                            print_chunk("</code></pre>\n<div class='execution-status' style='margin-top: 8px; padding: 8px; background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.2); border-radius: 4px; display: flex; align-items: center; justify-content: space-between;'>\n<span style='color: #93c5fd; font-size: 0.9em;'>等待确认...</span>\n<button style='background: #3b82f6; color: white; border: none; padding: 4px 12px; border-radius: 4px; cursor: pointer; font-size: 0.85em; font-weight: 500;'>运行代码</button>\n</div>\n</details>\n")
                        else:
                            # Empty or only comments, ignore it.
                            pass
                            
                        state = "ACTION"
                        buffer = remaining
                        code_buffer = ""
                        continue
                    
                    # If no closing backticks yet
                    code_buffer += buffer
                    buffer = ""
                    
                    # Optimization: If code_buffer has non-comment content, we can decide it's not empty early.
                    has_real_code = False
                    for line in code_buffer.split('\n'):
                        if line.strip() and not line.strip().startswith('#'):
                            has_real_code = True
                            break
                    
                    if has_real_code:
                         print_chunk("<details open><summary>指令执行</summary>\n<pre><code class='language-python'>")
                         print_chunk(code_buffer)
                         state = "EXECUTING" # Switch to normal executing state which streams
                         code_buffer = ""
                         continue
                    
                    break
                    
                elif state == "EXECUTING":
                    if "```" in buffer:
                        pre, post = buffer.split("```", 1)
                        if pre: print_chunk(pre)
                        print_chunk("</code></pre>\n<div class='execution-status' style='margin-top: 8px; padding: 8px; background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.2); border-radius: 4px; display: flex; align-items: center; justify-content: space-between;'>\n<span style='color: #93c5fd; font-size: 0.9em;'>等待确认...</span>\n<button style='background: #3b82f6; color: white; border: none; padding: 4px 12px; border-radius: 4px; cursor: pointer; font-size: 0.85em; font-weight: 500;'>运行代码</button>\n</div>\n</details>\n")
                        state = "ACTION"
                        buffer = post
                        continue
                        
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
