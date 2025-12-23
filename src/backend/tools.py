import os
import json
import inspect
import hashlib
import re
from datetime import datetime
from api_client import chat_completion
from ShareMemory.P0_config import P0Config

# --- Registry ---

LLM_CONFIG = {}
TOOLS_TMP_FILE = os.path.join(os.path.dirname(__file__), 'tools_tmp.py')

def set_llm_config(config):
    global LLM_CONFIG
    LLM_CONFIG = config

def clear_temporary_tools():
    """Clears the temporary tools file."""
    try:
        with open(TOOLS_TMP_FILE, 'w', encoding='utf-8') as f:
            f.write("from tools import register_tool\n\n# Temporary tools file. Cleared on new chat.\n")
        return "Temporary tools cleared."
    except Exception as e:
        return f"Error clearing temporary tools: {str(e)}"

def register_tool(func):
    """Decorator to register a function as a tool."""
    P0Config.TOOLS.register(func)
    return func

def get_tools_definitions():
    """Returns a list of tool definitions for the LLM."""
    definitions = []
    for name, func in P0Config.TOOLS.get_visible_tools().items():
        doc = func.__doc__ or ""
        sig = inspect.signature(func)
        params = {}
        required = []
        for param_name, param in sig.parameters.items():
            param_type = "string"
            if param.annotation == int:
                param_type = "integer"
            elif param.annotation == bool:
                param_type = "boolean"
            elif param.annotation == list:
                param_type = "array"
            elif param.annotation == dict:
                param_type = "object"
            
            params[param_name] = {
                "type": param_type,
                "description": f"Parameter {param_name}"
            }
            if param.default == inspect.Parameter.empty:
                required.append(param_name)
        
        definitions.append({
            "name": name,
            "description": doc.strip(),
            "parameters": {
                "type": "object",
                "properties": params,
                "required": required
            }
        })
    return definitions

def execute_tool(_tool_name, **kwargs):
    """Executes a registered tool."""
    func = P0Config.TOOLS.get_tool_func(_tool_name)
    if func:
        try:
            return func(**kwargs)
        except Exception as e:
            return f"Error executing tool {_tool_name}: {str(e)}"
    return f"Tool {_tool_name} not found."

# --- Helper Functions ---

def _is_binary_file(file_path):
    text_extensions = {'.txt', '.md', '.py', '.js', '.ts', '.jsx', '.tsx', '.html', '.css', '.json', '.xml', '.yaml', '.yml', '.ini', '.conf', '.sh', '.bat', '.ps1', '.c', '.cpp', '.h', '.java', '.cs', '.go', '.rs', '.php', '.rb', '.lua', '.sql', '.log'}
    ext = os.path.splitext(file_path)[1].lower()
    if ext in text_extensions:
        return False
        
    try:
        with open(file_path, 'rb') as f:
            chunk = f.read(4096)
            return b'\x00' in chunk
    except:
        return True

# --- Built-in Tools ---

@register_tool
def scan_workspace(workspace_path: str) -> list:
    """
    Scans the workspace and returns a list of all file paths.
    Useful to understand the project structure.
    """
    file_list = []
    ignore_dirs = {'.git', 'node_modules', '__pycache__', '.vscode', 'dist', 'build', 'coverage', '.wand'}
    
    for root, dirs, files in os.walk(workspace_path):
        dirs[:] = [d for d in dirs if d not in ignore_dirs]
        
        for file in files:
            if file.startswith('.'): continue
            file_path = os.path.join(root, file)
            file_list.append(file_path)
    return file_list

@register_tool
def read_file(file_path: str) -> str:
    """
    Reads the content of a file. 
    Supports text files and PDF (if pypdf is installed).
    """
    if not os.path.exists(file_path):
        return f"Error: File not found: {file_path}"

    ext = os.path.splitext(file_path)[1].lower()
    
    if ext == '.pdf':
        try:
            from pypdf import PdfReader
            reader = PdfReader(file_path)
            text_list = []
            for page in reader.pages:
                text_list.append(page.extract_text())
            return "\n".join(text_list)
        except ImportError:
            return "Error: PDF file detected but pypdf is not installed."
        except Exception as e:
            return f"Error reading PDF: {str(e)}"
    
    if _is_binary_file(file_path):
        return f"Error: File {os.path.basename(file_path)} appears to be binary."
    
    try:
        with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
            content = f.read()
            if len(content) > 50000:
                return content[:50000] + "\n...[Content truncated]..."
            return content
    except Exception as e:
        return f"Error reading file: {str(e)}"

# @register_tool
# def save_tool(name: str, code: str, description: str):
#     """
#     Permanently saves a tool that was previously created in memory.
    
#     Args:
#         name: The name of the tool function.
#         code: The full Python code of the tool.
#         description: The description of the tool.
#     """
#     target_file = os.path.join(os.path.dirname(__file__), 'tools_gen.py')
    
#     # Ensure code has @register_tool decorator if missing
#     if "@register_tool" not in code:
#         code = "@register_tool\n" + code

#     # Explicitly set the docstring ONLY if not already present in the code
#     # We check for triple quotes as a heuristic for existing docstrings
#     has_docstring = '"""' in code or "'''" in code
#     if not has_docstring and f"{name}.__doc__ =" not in code:
#         code += f"\n{name}.__doc__ = {json.dumps(description)}"

#     # Format description as comments, handling multiple lines
#     commented_desc = "\n".join([f"# {line}" for line in description.split('\n')])

#     new_tool_code = f"\n\n# --- Tool: {name} ---\n"
#     new_tool_code += f"{commented_desc}\n"
#     new_tool_code += code + "\n"
    
#     try:
#         with open(target_file, 'a', encoding='utf-8') as f:
#             f.write(new_tool_code)
#         return f"Tool '{name}' has been permanently saved to tools_gen.py."
#     except Exception as e:
#         return f"Error saving tool: {str(e)}"

def _register_tool_memory(name: str, code: str, description: str):
    """
    Internal helper to register tool in memory AND tools_tmp.py, then return JSON for UI.
    """
    # Security check
    if "import os" in code and "remove" in code:
        return "Error: Potentially dangerous code detected."

    # Validation
    if f"def {name}" not in code:
        return f"Error: The code must define a function named '{name}'. Please wrap your logic in 'def {name}(...):'."

    # Ensure code has @register_tool decorator if missing
    if "@register_tool" not in code:
        code = "@register_tool\n" + code

    # Explicitly set the docstring ONLY if not already present
    has_docstring = '"""' in code or "'''" in code
    if not has_docstring and f"{name}.__doc__ =" not in code:
        code += f"\n{name}.__doc__ = {json.dumps(description)}"
    
    try:
        # 1. Execute in current globals to register it in memory (for immediate use)
        exec(code, globals())
        
        # 2. Append to tools_tmp.py (for persistence across turns in same session)
        try:
            # Ensure file exists with header if not
            if not os.path.exists(TOOLS_TMP_FILE):
                with open(TOOLS_TMP_FILE, 'w', encoding='utf-8') as f:
                    f.write("from tools import register_tool\n\n# Temporary tools file. Cleared on new chat.\n")
            
            with open(TOOLS_TMP_FILE, 'a', encoding='utf-8') as f:
                f.write(f"\n\n# --- Temp Tool: {name} ---\n{code}\n")
        except Exception as file_err:
            # If file write fails, we still return success for memory registration, but warn
            print(f"Warning: Failed to write to tools_tmp.py: {file_err}")

        # Get signature
        func = P0Config.TOOLS.get_tool_func(name)
        sig = "(...)"
        if func:
            try:
                sig = str(inspect.signature(func))
            except:
                pass
        
        # Return JSON structure for the UI
        result = {
            "status": "temporary_tool_created",
            "name": name,
            "description": description,
            "code": code,
            "signature": sig,
            "usage": f"{name}{sig}"
        }
        return json.dumps(result)
            
    except Exception as e:
        return f"Error loading tool in memory: {str(e)}"

@register_tool
def create_tool(requirement: str):
    """
    Creates a new tool based on the given requirement description.
    The tool is created in MEMORY only. To save it permanently, the user must confirm.
    
    Args:
        requirement: A detailed description of what the tool should do. It should include a standard comment template with a detailed description, Args (with input examples), and Returns to ensure clear input formats.
    """
    if not LLM_CONFIG:
        return "Error: LLM configuration not set. Cannot use Code Agent."

    # 1. Construct Prompt for Code Agent
    system_prompt = """You are an expert Python developer specializing in creating tools for an AI assistant.
Your task is to write a Python function based on the user's requirement.

Rules:
1. The function must be generic and reusable.
2. The function must be fully self-contained (import necessary modules inside the function).
3. The function must have a standard docstring including a detailed description, an 'Args:' section with clear types and input examples for each parameter to avoid ambiguity, and a 'Returns:' section. If an argument is a file path, explicitly describe the expected file format.
4. The function name should be snake_case and descriptive.
5. You must output the code inside a markdown code block: ```python ... ```
6. You must also provide a short description and the function name.
7. Do NOT use `print` for output; return the result.
8. Handle errors gracefully and return error messages as strings if needed.
9. Do NOT include the @register_tool decorator in your output; it will be added automatically.

Output Format:
Name: <function_name>
Description: <short_description>
Code:
```python
def function_name(...):
    \"\"\"
    Detailed description of the function.

    Args:
        param1 (type): Description. Example: "example_value"
    
    Returns:
        type: Description of return value.
    \"\"\"
    ...
```
"""
    
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"Create a tool for this requirement: {requirement}"}
    ]

    max_retries = 3
    last_error = None

    for attempt in range(max_retries):
        # 2. Call LLM
        try:
            # Use standardTextModel for code generation if available (usually smarter), 
            # otherwise fallback to high speed model.
            model = LLM_CONFIG.get('standardTextModel') or LLM_CONFIG.get('highSpeedTextModel')
            
            response = chat_completion(
                api_key=LLM_CONFIG.get('apiKey'),
                base_url=LLM_CONFIG.get('baseUrl'),
                model=model,
                messages=messages
            )
        except Exception as e:
            return f"Error calling Code Agent: {str(e)}"

        # 3. Parse Response
        name_match = re.search(r"Name:\s*(.+)", response)
        desc_match = re.search(r"Description:\s*(.+)", response)
        code_match = re.search(r"```python\s*(.*?)\s*```", response, re.DOTALL)

        name = None
        description = None
        code = None

        if name_match and desc_match and code_match:
            name = name_match.group(1).strip()
            code = code_match.group(1).strip()
            # Prefer docstring
            docstring_match = re.search(r'"""(.*?)"""', code, re.DOTALL)
            if docstring_match:
                description = docstring_match.group(1).strip()
            else:
                description = desc_match.group(1).strip()
        elif code_match:
            # Fallback
            code = code_match.group(1).strip()
            def_match = re.search(r"def\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(", code)
            if def_match:
                name = def_match.group(1)
                docstring_match = re.search(r'"""(.*?)"""', code, re.DOTALL)
                if docstring_match:
                    description = docstring_match.group(1).strip()
                else:
                    description = requirement
        
        if not name or not code:
             last_error = "Failed to parse output format."
             messages.append({"role": "assistant", "content": response})
             messages.append({"role": "user", "content": f"Error: {last_error} Please ensure you follow the Output Format exactly."})
             continue

        # 4. Sandbox Verification
        try:
            # Syntax Check
            compile(code, '<string>', 'exec')
            
            # Definition Check
            sandbox_globals = {}
            # We might need to mock imports or provide context if the tool relies on them, 
            # but the prompt says "self-contained".
            exec(code, sandbox_globals)
            
            if name not in sandbox_globals:
                raise ValueError(f"Function '{name}' was not defined in the generated code.")
            
            if not callable(sandbox_globals[name]):
                raise ValueError(f"'{name}' is not a callable function.")

            # If successful, register
            return _register_tool_memory(name, code, description)

        except Exception as verify_err:
            last_error = f"Sandbox Verification Failed: {str(verify_err)}"
            messages.append({"role": "assistant", "content": response})
            messages.append({"role": "user", "content": f"The code you generated failed verification:\n{last_error}\n\nPlease fix the code and output the full corrected response following the same format."})
            continue

    return f"Failed to create tool after {max_retries} attempts. Last error: {last_error}"

@register_tool
def list_files(directory_path: str) -> list:
    """
    Lists files in a specific directory.
    """
    try:
        return os.listdir(directory_path)
    except Exception as e:
        return [f"Error: {str(e)}"]

# --- Import Generated Tools ---
try:
    from tools_gen import *
except ImportError as e:
    # Ignore if tools_gen is empty or has issues initially
    pass

# --- Import Temporary Tools ---
try:
    if os.path.exists(TOOLS_TMP_FILE):
        # We use exec to load the file content into the current namespace
        # This avoids module caching issues since we want the latest version
        with open(TOOLS_TMP_FILE, 'r', encoding='utf-8') as f:
            exec(f.read(), globals())
except Exception as e:
    # Ignore errors in temp tools to prevent crashing the main app
    print(f"Warning: Failed to load tools_tmp.py: {e}")

@register_tool
def write_file(file_path, content):
    """
    Writes text content to a specified file path, creating the file if it doesn't exist or overwriting it if it does.

    Args:
        file_path (str): The path to the file where content will be written.
        content (str): The text content to write to the file.

    Returns:
        str: Success message if writing is successful, or error message if an exception occurs.
    """
    try:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        return f"Successfully wrote content to {file_path}"
    except Exception as e:
        return f"Error writing to file: {str(e)}"