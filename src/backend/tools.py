import os
import json
import inspect
import hashlib
from datetime import datetime

# --- Registry ---

TOOLS = {}

def register_tool(func):
    """Decorator to register a function as a tool."""
    TOOLS[func.__name__] = func
    return func

def get_tools_definitions():
    """Returns a list of tool definitions for the LLM."""
    definitions = []
    for name, func in TOOLS.items():
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
    if _tool_name in TOOLS:
        try:
            return TOOLS[_tool_name](**kwargs)
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

@register_tool
def create_tool(name: str, code: str, description: str):
    """
    Creates a new tool by saving the python code to the configuration file.
    IMPORTANT: The `code` argument MUST contain a full Python function definition (starting with `def name(...):`). 
    Do not pass raw statements. The function name in `code` must match the `name` argument.
    """
    # Security check
    if "import os" in code and "remove" in code:
        return "Error: Potentially dangerous code detected."

    # Validation
    if f"def {name}" not in code:
        return f"Error: The code must define a function named '{name}'. Please wrap your logic in 'def {name}(...):'."

    # Target file: tools_gen.py
    target_file = os.path.join(os.path.dirname(__file__), 'tools_gen.py')
    
    # Ensure code has @register_tool decorator if missing
    if "@register_tool" not in code:
        code = "@register_tool\n" + code

    # Explicitly set the docstring to ensure it is available for get_tools_definitions
    # This is appended after the function definition
    code += f"\n{name}.__doc__ = {json.dumps(description)}"

    new_tool_code = f"\n\n# --- Tool: {name} ---\n"
    new_tool_code += f"# Description: {description}\n"
    new_tool_code += code + "\n"
    
    try:
        with open(target_file, 'a', encoding='utf-8') as f:
            f.write(new_tool_code)
            
        # Try to load it into the current session
        try:
            # We need to execute the code in a context where register_tool is available.
            # Since we are in tools.py, register_tool is defined here.
            # But we are executing code that might depend on imports in tools_gen.py.
            # For simplicity, we exec in the current globals, which has register_tool.
            exec(code, globals())
            return f"Tool {name} created and loaded successfully."
        except Exception as exec_error:
            return f"Tool {name} saved to file, but failed to load in current session: {str(exec_error)}"
            
    except Exception as e:
        return f"Error creating tool: {str(e)}"

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
