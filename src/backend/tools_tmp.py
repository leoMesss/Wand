from tools import register_tool

# Temporary tools file. Cleared on new chat.


# --- Temp Tool: calculate_sum_of_three ---
@register_tool
def calculate_sum_of_three(a, b, c):
    """
    Calculates the sum of three numeric inputs.

    Args:
        a (float): The first number. Example input: 5.0, -2.3, 3.14
        b (float): The second number. Example input: 4.0, 1.7, -1.0
        c (float): The third number. Example input: 1.0, 0.5, 2.8

    Returns:
        float: The sum of the three input numbers. Example output: 10.0, 0.0, 6.44
    """
    try:
        return float(a) + float(b) + float(c)
    except (TypeError, ValueError) as e:
        return f"Error: Invalid input - {e}"
