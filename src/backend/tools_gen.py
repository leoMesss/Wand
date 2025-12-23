from tools import register_tool
import os
import json

# This file is for AI-generated tools.

# --- Tool: read_excel_to_dict_list ---
# Reads an Excel file and converts its content into a list of dictionaries,
#     where each dictionary corresponds to a row in the sheet, with column headers as keys.
# 
#     Args:
#         file_path (str): Path to the Excel file (.xlsx or .xls). Example: "data/sales.xlsx"
#         limit (int, optional): Maximum number of rows to return. Default is 5. Use None for all rows. Example: 10
# 
#     Returns:
#         list or str: List of dictionaries if successful, or error message as string if failed.
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
