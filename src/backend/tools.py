import os
import json
import sys
import inspect
import hashlib
import re
import concurrent.futures
from datetime import datetime
from api_client import chat_completion
from configs.P10_config import P10Config

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
    def __init__(self, name, description, func, permission_level=PermissionLevel.P5, code=None, **kwargs):
        self.name = name
        self.description = description
        self.func = func
        self.permission_level = permission_level
        self.is_visible = True
        self.is_gen = kwargs.get('is_gen', False)
        self.tool_type = kwargs.get('tool_type', 'general')
        self.code = code
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
        return {name: {"name": t.name, "description": t.description, "is_visible": t.is_visible, "permission_level": t.permission_level, "is_gen": t.is_gen, "tool_type": t.tool_type, "code": t.code, "metadata": t.metadata} 
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
TOOLS_CONFIG_FILE = os.path.join(os.path.dirname(__file__), 'tools_config.json')

def load_tool_config():
    """Loads tool configuration (visibility) from disk."""
    if os.path.exists(TOOLS_CONFIG_FILE):
        try:
            with open(TOOLS_CONFIG_FILE, 'r', encoding='utf-8') as f:
                config = json.load(f)
                for name, visible in config.get('visibility', {}).items():
                    P10Config.TOOLS.set_visibility(name, visible)
        except Exception as e:
            sys.stderr.write(f"Warning: Error loading tool config: {e}\n")

def update_tool_visibility_config(name, is_visible):
    """Updates the visibility of a tool and saves to disk."""
    # Update in memory
    P10Config.TOOLS.set_visibility(name, is_visible)
    
    # Update on disk
    config = {}
    if os.path.exists(TOOLS_CONFIG_FILE):
        try:
            with open(TOOLS_CONFIG_FILE, 'r', encoding='utf-8') as f:
                config = json.load(f)
        except:
            pass
    
    if 'visibility' not in config:
        config['visibility'] = {}
    
    config['visibility'][name] = is_visible
    
    try:
        with open(TOOLS_CONFIG_FILE, 'w', encoding='utf-8') as f:
            json.dump(config, f, indent=2)
        return "Success"
    except Exception as e:
        return f"Error saving config: {str(e)}"

def save_tool(name: str, code: str, description: str, permission_level: int = 9, tool_type: str = "general", is_gen: bool = True, metadata: dict = None):
    """
    Permanently saves a tool to tools.json.
    
    Args:
        name: The name of the tool function.
        code: The full Python code of the tool.
        description: The description of the tool.
        permission_level: The permission level (default 9).
        tool_type: The type of tool (default "general").
        is_gen: Whether the tool is generated (default True).
        metadata: Additional metadata (default None).
    """
    json_path = os.path.join(os.path.dirname(__file__), 'tools.json')
    
    if metadata is None:
        metadata = {}
    
    # Validation: Check if name is a valid Python identifier
    if not name.isidentifier():
        return f"Error: Tool name '{name}' is not a valid Python identifier. It must start with a letter or underscore and contain only letters, numbers, and underscores."

    # Validation: Check if function name in code matches the tool name
    if f"def {name}" not in code:
        return f"Error: The code must define a function named '{name}'. Please ensure your code contains 'def {name}(...):'."

    if not description or not description.strip():
        return "Error: Tool description is required. Please ensure your function has a docstring."

    # Remove @register_tool decorator if present
    lines = code.split('\n')
    clean_lines = [line for line in lines if not line.strip().startswith('@register_tool')]
    clean_code = '\n'.join(clean_lines).strip()

    try:
        with open(json_path, 'r', encoding='utf-8') as f:
            tools_data = json.load(f)
    except Exception:
        tools_data = {}
        
    # Preserve existing visibility if possible, else default to True
    existing_visibility = True
    if name in tools_data:
        existing_visibility = tools_data[name].get("is_visible", True)

    tools_data[name] = {
        "name": name,
        "description": description,
        "func": clean_code,
        "permission_level": permission_level,
        "is_visible": existing_visibility,
        "is_gen": is_gen,
        "tool_type": tool_type,
        "metadata": metadata
    }
    
    try:
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(tools_data, f, indent=2, ensure_ascii=False)
        return f"Tool '{name}' has been permanently saved to tools.json."
    except Exception as e:
        return f"Error saving tool: {str(e)}"

def delete_tool(name: str):
    """
    Permanently deletes a tool from tools.json and the registry.
    """
    json_path = os.path.join(os.path.dirname(__file__), 'tools.json')
    
    # 1. Remove from tools.json
    try:
        if os.path.exists(json_path):
            with open(json_path, 'r', encoding='utf-8') as f:
                tools_data = json.load(f)
            
            if name in tools_data:
                del tools_data[name]
                
                with open(json_path, 'w', encoding='utf-8') as f:
                    json.dump(tools_data, f, indent=2, ensure_ascii=False)
    except Exception as e:
        return f"Error deleting tool from disk: {str(e)}"

    # 2. Remove from registry
    if name in P10Config.TOOLS._registry:
        del P10Config.TOOLS._registry[name]
        
    return f"Tool '{name}' has been deleted."

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
        try:
            code = inspect.getsource(f)
        except:
            code = None
        tool = Tool(name, description, f, permission_level=permission_level, code=code, **kwargs)
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
            },
            "is_visible": tool.is_visible, # Include visibility in definition for UI
            "tool_type": tool.tool_type
        })
    return definitions

def _convert_tool_arguments(func, kwargs):
    """
    Pre-processes arguments by converting types based on function signature or heuristics.
    """
    try:
        sig = inspect.signature(func)
    except ValueError:
        return kwargs

    new_kwargs = kwargs.copy()
    
    for param_name, value in new_kwargs.items():
        if param_name in sig.parameters:
            param = sig.parameters[param_name]
            annotation = param.annotation
            
            # Only attempt conversion if the value is a string
            if isinstance(value, str):
                converted = False
                
                # 1. Try explicit type hints
                if annotation != inspect.Parameter.empty:
                    try:
                        # Handle basic types and typing.List/Dict
                        is_list_or_dict = (annotation == list or annotation == dict)
                        # Check for generic types like List[int]
                        if not is_list_or_dict and hasattr(annotation, '__origin__'):
                            is_list_or_dict = annotation.__origin__ in (list, dict)
                        
                        if is_list_or_dict:
                            new_kwargs[param_name] = json.loads(value)
                            converted = True
                        elif annotation == int:
                            new_kwargs[param_name] = int(value)
                            converted = True
                        elif annotation == float:
                            new_kwargs[param_name] = float(value)
                            converted = True
                        elif annotation == bool:
                            if value.lower() == 'true': 
                                new_kwargs[param_name] = True
                                converted = True
                            elif value.lower() == 'false': 
                                new_kwargs[param_name] = False
                                converted = True
                    except:
                        pass
                
                # 2. Heuristic fallback if no type hint or conversion didn't happen
                if not converted and annotation == inspect.Parameter.empty:
                    val_str = value.strip()
                    # Try JSON (List/Dict)
                    if (val_str.startswith('[') and val_str.endswith(']')) or \
                       (val_str.startswith('{') and val_str.endswith('}')):
                        try:
                            new_kwargs[param_name] = json.loads(val_str)
                            continue
                        except:
                            pass
                    
                    # Try Int
                    if val_str.lstrip('-').isdigit():
                        try:
                            new_kwargs[param_name] = int(val_str)
                            continue
                        except:
                            pass
                            
                    # Try Bool
                    if val_str.lower() == 'true':
                        new_kwargs[param_name] = True
                        continue
                    elif val_str.lower() == 'false':
                        new_kwargs[param_name] = False
                        continue
                        
    return new_kwargs

def execute_tool(_tool_name, **kwargs):
    """Executes a registered tool."""
    tool = P10Config.TOOLS.get_tool(_tool_name)
    if tool and tool.is_visible:
        try:
            # Pre-process arguments
            converted_kwargs = _convert_tool_arguments(tool.func, kwargs)
            return tool.run(**converted_kwargs)
        except Exception as e:
            return f"Error executing tool {_tool_name}: {str(e)}"
    return f"Tool {_tool_name} not found or disabled."

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
            sys.stderr.write(f"Warning: Failed to write to tools_tmp.py: {file_err}\n")

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
    
# --- Built-in Tools ---

def load_tools_from_json():
    """Loads tools from tools.json and registers them."""
    json_path = os.path.join(os.path.dirname(__file__), 'tools.json')
    if not os.path.exists(json_path):
        sys.stderr.write(f"Warning: {json_path} not found.\n")
        return

    try:
        with open(json_path, 'r', encoding='utf-8') as f:
            tools_data = json.load(f)

        for tool_name, tool_info in tools_data.items():
            # 1. Execute the function code
            func_code = tool_info.get('func')
            if not func_code or not func_code.strip():
                sys.stderr.write(f"Warning: No code for tool {tool_name}\n")
                continue
            
            try:
                # Execute in globals() so functions are available in module scope
                exec(func_code, globals())
            except Exception as e:
                sys.stderr.write(f"Error executing code for tool {tool_name}: {e}\n")
                continue
            
            # 2. Get the function object
            # We assume the function name in code matches the tool name or is the only function defined
            # But for simplicity, let's assume the function name is the same as tool_name
            # or we can parse it from the code if needed.
            # In our generated JSON, the function name matches the key.
            
            func_obj = globals().get(tool_name)
            if not func_obj or not callable(func_obj):
                sys.stderr.write(f"Error: Function {tool_name} not found after execution.\n")
                continue

            # 3. Register the tool
            tool = Tool(
                name=tool_info['name'],
                description=tool_info['description'],
                func=func_obj,
                permission_level=tool_info['permission_level'],
                is_gen=tool_info.get('is_gen', False),
                tool_type=tool_info.get('tool_type', 'general'),
                code=func_code,
                **tool_info.get('metadata', {})
            )
            tool.is_visible = tool_info.get('is_visible', True)
            
            P10Config.TOOLS.register(tool)
            
    except Exception as e:
        sys.stderr.write(f"Error loading tools from JSON: {e}\n")

# Load tools from JSON at startup
load_tools_from_json()
# Load visibility overrides
load_tool_config()