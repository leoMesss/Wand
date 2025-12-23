from tools import register_tool

# Temporary tools file. Cleared on new chat.


# --- Temp Tool: calculate_column_difference_in_excel ---
@register_tool
def calculate_column_difference_in_excel(file_path, minuend_column, subtrahend_column, output_file_path=None):
    """
    Reads an Excel file, calculates the difference between two specified columns (minuend - subtrahend),
    adds the result as a new column named '差值', and saves the updated data.

    Args:
        file_path (str): Path to the input Excel file. Example: "data.xlsx"
        minuend_column (str): Name of the column from which to subtract (the first term). Example: "总价"
        subtrahend_column (str): Name of the column to subtract (the second term). Example: "单价"
        output_file_path (str, optional): Path to save the updated Excel file. If not provided, 
                                          the input file will be overwritten. Example: "output.xlsx"

    Returns:
        str: Success message or error description.
    """
    try:
        import pandas as pd

        # Read the Excel file
        try:
            df = pd.read_excel(file_path)
        except FileNotFoundError:
            return f"Error: The file '{file_path}' was not found."
        except Exception as e:
            return f"Error: Failed to read the file '{file_path}'. Details: {str(e)}"

        # Check if the specified columns exist
        missing_columns = []
        if minuend_column not in df.columns:
            missing_columns.append(minuend_column)
        if subtrahend_column not in df.columns:
            missing_columns.append(subtrahend_column)

        if missing_columns:
            return f"Error: The following column(s) are missing in the file: {', '.join(missing_columns)}"

        # Ensure both columns are numeric
        if not pd.api.types.is_numeric_dtype(df[minuend_column]):
            return f"Error: Column '{minuend_column}' must contain numeric data."
        if not pd.api.types.is_numeric_dtype(df[subtrahend_column]):
            return f"Error: Column '{subtrahend_column}' must contain numeric data."

        # Compute the difference and add as new column
        df['差值'] = df[minuend_column] - df[subtrahend_column]

        # Determine output path
        save_path = output_file_path if output_file_path else file_path

        # Save the updated DataFrame back to Excel
        try:
            df.to_excel(save_path, index=False)
        except Exception as e:
            return f"Error: Failed to write to the file '{save_path}'. Details: {str(e)}"

        return f"Success: Difference between '{minuend_column}' and '{subtrahend_column}' computed and saved to '{save_path}'."

    except ImportError:
        return "Error: Required library 'pandas' is not installed."
    except Exception as e:
        return f"An unexpected error occurred: {str(e)}"


# --- Temp Tool: get_excel_column_headers ---
@register_tool
def get_excel_column_headers(file_path):
    """
    Reads an Excel file and returns the list of column headers from the first row.

    Args:
        file_path (str): Path to the Excel file (.xlsx or .xls). Example: "data/sales_data.xlsx"

    Returns:
        list or str: List of column names (strings) if successful, or an error message as a string if an exception occurs.
    """
    try:
        import pandas as pd
    except ImportError:
        return "Error: pandas is not installed. Please install it using 'pip install pandas'."

    try:
        # Read the first row of the Excel file to get headers
        df = pd.read_excel(file_path, nrows=0)  # nrows=0 reads only the header
        return list(df.columns)
    
    except FileNotFoundError:
        return f"Error: File not found at '{file_path}'. Please check the file path and try again."
    
    except PermissionError:
        return f"Error: Permission denied when reading the file '{file_path}'."
    
    except Exception as e:
        return f"Error: Unable to read the Excel file. {str(e)}"


# --- Temp Tool: read_excel_to_dict_list ---
@register_tool
def read_excel_to_dict_list(file_path, limit=5):
    """
    Reads an Excel file and converts its content into a list of dictionaries,
    where each dictionary corresponds to a row in the sheet, with column headers as keys.

    Args:
        file_path (str): Path to the Excel file (.xlsx or .xls). Example: "data/sales.xlsx"
        limit (int, optional): Maximum number of rows to return. Default is 5. Use None for all rows. Example: 10

    Returns:
        list or str: List of dictionaries if successful, or error message as string if failed.
    """
    try:
        import pandas as pd
    except ImportError:
        return "Error: pandas is not installed. Please install it using 'pip install pandas'."

    try:
        # Read the Excel file
        df = pd.read_excel(file_path)

        # Convert to list of dictionaries
        if limit is None:
            result = df.to_dict(orient='records')
        else:
            result = df.head(limit).to_dict(orient='records')

        return result

    except Exception as e:
        return f"Error: {str(e)}"
