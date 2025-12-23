import os
import json
import inspect
import hashlib
import re
import concurrent.futures
from datetime import datetime
from api_client import chat_completion
from ShareMemory.P10_config import P10Config

# --- Registry ---

class PermissionLevel:
    """
    Tool Permission Levels
    P5: Public Info (Weather, Time, Web Search) - No side effects, no local access.
    P6: Workspace Read (List files, Read files) - Read-only access to local workspace.
    P7: Workspace Analysis (Linter, Static Analysis) - High-compute read-only or temp file creation.
    P8: Workspace Write (Write files, Delete files) - Modifies project files.
    P9: Code Execution (Create Tool, Run Script) - Executes arbitrary code or changes agent capabilities.
    P10: System Control (System Prompt, Planning) - Changes core agent behavior or configuration.
    """
    P5 = 5
    P6 = 6
    P7 = 7
    P8 = 8
    P9 = 9
    P10 = 10

class Tool:
    def __init__(self, name, description, func, permission_level=PermissionLevel.P5, **kwargs):
        self.name = name
        self.description = description
        self.func = func
        self.permission_level = permission_level
        self.is_visible = True
        self.metadata = kwargs

    def run(self, **kwargs):
        return self.func(**kwargs)

class ToolRegistry:
    def __init__(self):
        self._registry = {}

    def register(self, tool):
        self._registry[tool.name] = tool

    def get_all_tools(self):
        """Returns a dictionary of all tools with their metadata."""
        return {name: {"name": t.name, "description": t.description, "is_visible": t.is_visible, "permission_level": t.permission_level} 
                for name, t in self._registry.items()}

    def get_visible_tools(self):
        """Returns a dictionary of visible tools mapping name to Tool object."""
        return {name: tool for name, tool in self._registry.items() if tool.is_visible}

    def set_visibility(self, name, is_visible):
        if name in self._registry:
            self._registry[name].is_visible = is_visible

    def set_all_visible(self):
        for tool in self._registry.values():
            tool.is_visible = True

    def get_tool(self, name):
        return self._registry.get(name)

    def __contains__(self, name):
        return name in self._registry

# Initialize Global Registry
P10Config.TOOLS = ToolRegistry()

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

def register_tool(func=None, permission_level=PermissionLevel.P5, **kwargs):
    """
    Decorator to register a function as a tool.
    Can be used as @register_tool or @register_tool(permission_level=PermissionLevel.P10, key=value).
    """
    def _register(f):
        name = f.__name__
        description = f.__doc__ or ""
        tool = Tool(name, description, f, permission_level=permission_level, **kwargs)
        P10Config.TOOLS.register(tool)
        return f

    if func is None:
        return _register
    else:
        return _register(func)

def get_tools_definitions():
    """Returns a list of tool definitions for the LLM."""
    definitions = []
    for name, tool in P10Config.TOOLS.get_visible_tools().items():
        doc = tool.description
        # Use the underlying function for signature inspection
        sig = inspect.signature(tool.func)
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
    tool = P10Config.TOOLS.get_tool(_tool_name)
    if tool:
        try:
            return tool.run(**kwargs)
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

@register_tool(permission_level=PermissionLevel.P6)
def scan_workspace(workspace_path: str) -> list:
    """
    Scans the workspace and returns a list of files with their basic metadata.
    Useful to understand the project structure, file sizes, and modification times.
    
    Returns:
        list: A list of dictionaries, each containing 'path', 'size' (bytes), and 'last_modified'.
    """
    file_list = []
    ignore_dirs = {'.git', 'node_modules', '__pycache__', '.vscode', 'dist', 'build', 'coverage', '.wand'}
    
    for root, dirs, files in os.walk(workspace_path):
        dirs[:] = [d for d in dirs if d not in ignore_dirs]
        
        for file in files:
            if file.startswith('.'): continue
            file_path = os.path.join(root, file)
            try:
                stats = os.stat(file_path)
                file_info = {
                    "path": file_path,
                    "size": stats.st_size,
                    "last_modified": datetime.fromtimestamp(stats.st_mtime).isoformat()
                }
                file_list.append(file_info)
            except Exception:
                file_list.append({"path": file_path, "size": -1, "last_modified": "Unknown"})
    return file_list

@register_tool(permission_level=PermissionLevel.P6)
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

# @register_tool(permission_level=PermissionLevel.P9)
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
        tool = P10Config.TOOLS.get_tool(name)
        sig = "(...)"
        if tool:
            try:
                sig = str(inspect.signature(tool.func))
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

@register_tool(permission_level=PermissionLevel.P9)
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

@register_tool(permission_level=PermissionLevel.P6)
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

@register_tool(permission_level=PermissionLevel.P8)
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

@register_tool(permission_level=PermissionLevel.P8)
def edit_file(file_path: str, old_text: str, new_text: str):
    """
    Edits a file by replacing a specific text segment with new text.
    
    **Preference**: Use this tool for ALL modification tasks (add, delete, update) on existing files. 
    Use 'write_file' only for creating new files or completely overwriting files.

    Strategies:
    - Modify: Set 'old_text' to the content you want to change, and 'new_text' to the desired content.
    - Delete: Set 'old_text' to the content you want to remove, and 'new_text' to an empty string "".
    - Add: Select a unique anchor line as 'old_text', and set 'new_text' to "anchor\\nnew_content" (to add after) or "new_content\\nanchor" (to add before).
    
    Args:
        file_path (str): The absolute path to the file.
        old_text (str): The exact text segment to be replaced. Must be unique in the file.
        new_text (str): The new text to replace the old text with.
        
    Returns:
        str: Success or error message.
    """
    if not os.path.exists(file_path):
        return f"Error: File not found: {file_path}"
        
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
            
        # Normalize line endings to \n for consistent matching
        old_text_normalized = old_text.replace('\r\n', '\n')
        new_text_normalized = new_text.replace('\r\n', '\n')
            
        if old_text_normalized not in content:
            # Fallback: Try stripping leading/trailing whitespace from old_text
            old_text_stripped = old_text_normalized.strip()
            if old_text_stripped and old_text_stripped in content:
                count = content.count(old_text_stripped)
                if count == 1:
                    # Found a unique match with stripped version
                    new_content = content.replace(old_text_stripped, new_text_normalized, 1)
                    with open(file_path, 'w', encoding='utf-8') as f:
                        f.write(new_content)
                    return f"Successfully edited {file_path} (matched with stripped whitespace)"
                elif count > 1:
                    return f"Error: 'old_text' not found exactly. A stripped version was found {count} times. Please provide more context."
            
            return "Error: 'old_text' not found in the file. Please ensure exact match including whitespace and indentation."
            
        count = content.count(old_text_normalized)
        if count > 1:
            return f"Error: 'old_text' found {count} times. Please provide more context in 'old_text' to make it unique."
            
        new_content = content.replace(old_text_normalized, new_text_normalized, 1)
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(new_content)
            
        return f"Successfully edited {file_path}"
    except Exception as e:
        return f"Error editing file: {str(e)}"

@register_tool(permission_level=PermissionLevel.P8)
def get_workspace_content_index():
    """
    Retrieves and updates the workspace content index with LLM-generated summaries.
    
    Difference from 'scan_workspace':
    - 'scan_workspace': Quickly lists file paths and basic metadata (structure only).
    - 'get_workspace_content_index': Analyzes file content to generate semantic summaries, helping the model understand the purpose of each file.

    Returns:
        str: The JSON string of the updated workspace index (Merkle Tree), containing file paths and descriptions.
    """
    # Use current working directory as workspace root
    workspace_path = os.getcwd()
    
    index_dir = os.path.join(workspace_path, '.wand')
    if not os.path.exists(index_dir):
        os.makedirs(index_dir)
    
    index_file = os.path.join(index_dir, 'workspace_index.json')
    
    # Load existing index
    old_index = {}
    if os.path.exists(index_file):
        try:
            with open(index_file, 'r', encoding='utf-8') as f:
                old_index = json.load(f)
        except:
            pass

    new_index = {}
    ignore_dirs = {'.git', 'node_modules', '__pycache__', '.vscode', 'dist', 'build', 'coverage', '.wand'}
    
    # 1. Scan and Calculate Hash
    files_to_process = []
    
    for root, dirs, files in os.walk(workspace_path):
        dirs[:] = [d for d in dirs if d not in ignore_dirs]
        
        for file in files:
            if file.startswith('.'): continue
            file_path = os.path.join(root, file)
            rel_path = os.path.relpath(file_path, workspace_path)
            
            try:
                with open(file_path, 'rb') as f:
                    content = f.read()
                    file_hash = hashlib.md5(content).hexdigest()
                    
                # Check if changed
                if rel_path in old_index and old_index[rel_path].get('hash') == file_hash:
                    new_index[rel_path] = old_index[rel_path]
                else:
                    # Needs update
                    files_to_process.append((rel_path, file_path, file_hash))
            except Exception as e:
                print(f"Error processing {rel_path}: {e}")

    # 2. Generate Descriptions for changed files
    if not LLM_CONFIG:
        return "Error: LLM configuration not set."
        
    model = LLM_CONFIG.get('highSpeedTextModel') or LLM_CONFIG.get('standardTextModel')
    api_key = LLM_CONFIG.get('apiKey')
    base_url = LLM_CONFIG.get('baseUrl')

    updated_count = 0

    def process_file_item(item):
        rel_path, file_path, file_hash = item
        
        # Read content (text only)
        if _is_binary_file(file_path):
             return rel_path, {
                "hash": file_hash,
                "path": file_path,
                "description": "[Binary File]"
            }

        try:
            with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
                content = f.read(10000) # Limit context
            
            prompt = f"Please describe the contents of this file. Keep the description concise and under 300 words. The goal is to allow the LLM to understand what is inside this file from a global perspective.\n\nFile: {rel_path}\n\nContent:\n{content}"
            
            messages = [{"role": "user", "content": prompt}]
            
            try:
                response = chat_completion(api_key, base_url, model, messages)
                description = response.strip()
            except Exception as e:
                description = f"Error generating description: {str(e)}"
            
            return rel_path, {
                "hash": file_hash,
                "path": file_path,
                "description": description,
                "last_modified": datetime.now().isoformat()
            }
            
        except Exception as e:
             return rel_path, {
                "hash": file_hash,
                "path": file_path,
                "description": f"Error reading file: {str(e)}"
            }

    # Use ThreadPoolExecutor for parallel processing
    if files_to_process:
        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
            future_to_file = {executor.submit(process_file_item, item): item for item in files_to_process}
            for future in concurrent.futures.as_completed(future_to_file):
                try:
                    rel_path, result_data = future.result()
                    new_index[rel_path] = result_data
                    updated_count += 1
                except Exception as e:
                    print(f"Error in thread processing: {e}")

    # 3. Save Index
    try:
        with open(index_file, 'w', encoding='utf-8') as f:
            json.dump(new_index, f, indent=2, ensure_ascii=False)
    except Exception as e:
        return f"Error saving index: {str(e)}"

    # Return index without hashes to save context
    sanitized_index = {k: {key: val for key, val in v.items() if key != 'hash'} for k, v in new_index.items()}
    return json.dumps(sanitized_index, ensure_ascii=False)