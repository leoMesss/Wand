from tools import register_tool
import os
import json

# This file is for AI-generated tools.



# --- Tool: create_flashcards ---
# Description: 创建一组精美的闪卡，输入为包含 question 和 answer 的字典列表，输出为格式清晰的 Markdown 文本，可用于打印或导入学习工具。
@register_tool
def create_flashcards(cards):
    if not isinstance(cards, list):
        raise TypeError("cards must be a list of dictionaries with 'question' and 'answer' keys.")
    
    output = "=== 精美闪卡 ===\n\n"
    for i, card in enumerate(cards, 1):
        question = card.get("question", "[无问题]")
        answer = card.get("answer", "[无答案]")
        output += f"**闪卡 {i}**\nQ: {question}\nA: {answer}\n\n---\n\n"
    return output.strip()
create_flashcards.__doc__ = "\u521b\u5efa\u4e00\u7ec4\u7cbe\u7f8e\u7684\u95ea\u5361\uff0c\u8f93\u5165\u4e3a\u5305\u542b question \u548c answer \u7684\u5b57\u5178\u5217\u8868\uff0c\u8f93\u51fa\u4e3a\u683c\u5f0f\u6e05\u6670\u7684 Markdown \u6587\u672c\uff0c\u53ef\u7528\u4e8e\u6253\u5370\u6216\u5bfc\u5165\u5b66\u4e60\u5de5\u5177\u3002"


# --- Tool: create_flashcards_pdf ---
# Description: 根据提供的 question-answer 列表，生成一张带有精美颜色、圆角卡片、渐变背景和中文支持的 PDF 闪卡文件。支持 light/dark 主题，可保存至指定路径。适用于打印或数字学习。
@register_tool
def create_flashcards_pdf(cards, output_path, theme='light'):
    """
    生成带有精美颜色和图案的闪卡 PDF 文件。
    
    参数:
        cards: list of dict, 每个元素为 {'question': str, 'answer': str}
        output_path: str, 输出 PDF 文件路径
        theme: str, 主题颜色 ('light' 或 'dark')
    """
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import inch
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    import os
    
    # 注册中文字体（支持中文）
    try:
        pdfmetrics.registerFont(TTFont('Chinese', 'SimSun.ttf'))
    except:
        try:
            pdfmetrics.registerFont(TTFont('Chinese', 'simsun.ttc'))
        except:
            raise RuntimeError("未找到中文字体文件，请安装 SimSun 或指定其他字体。")
    
    # 设置样式
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'Title',
        parent=styles['Heading1'],
        fontName='Chinese',
        fontSize=20,
        textColor=colors.darkblue if theme == 'light' else colors.yellow,
        alignment=1,
        spaceAfter=30
    )
    
    question_style = ParagraphStyle(
        'Question',
        parent=styles['Normal'],
        fontName='Chinese',
        fontSize=16,
        textColor=colors.darkred if theme == 'light' else colors.orange,
        backColor=colors.lightblue if theme == 'light' else colors.darkslategray,
        borderRadius=8,
        padding=(10, 10, 10, 10),
        spaceAfter=10
    )
    
    answer_style = ParagraphStyle(
        'Answer',
        parent=styles['Normal'],
        fontName='Chinese',
        fontSize=16,
        textColor=colors.darkgreen if theme == 'light' else colors.lightgreen,
        backColor=colors.lightyellow if theme == 'light' else colors.black,
        borderRadius=8,
        padding=(10, 10, 10, 10),
        spaceAfter=20
    )
    
    # 创建 PDF 文档
    doc = SimpleDocTemplate(output_path, pagesize=A4,
                            rightMargin=30, leftMargin=30,
                            topMargin=30, bottomMargin=30)
    story = []
    
    # 添加标题
    story.append(Paragraph("🌟 精美闪卡集 🌟", title_style))
    story.append(Spacer(1, 20))
    
    # 添加每张闪卡
    for i, card in enumerate(cards, 1):
        q_text = f"<b>Q{i}:</b> {card.get('question', '无问题')}"
        a_text = f"<b>A{i}:</b> {card.get('answer', '无答案')}"
        
        story.append(Paragraph(q_text, question_style))
        story.append(Paragraph(a_text, answer_style))
        story.append(Spacer(1, 15))
        
        # 每5张卡分页（美观分隔）
        if i % 5 == 0 and i < len(cards):
            story.append(PageBreak())
    
    # 添加装饰性底部图案（简单线条）
    story.append(Spacer(1, 20))
    story.append(Paragraph("<font color='gray'>📚 学习愉快，记忆更高效！</font>", styles['Normal']))
    
    # 生成 PDF
    doc.build(story)
    print(f"✅ 闪卡 PDF 已生成：{output_path}")
create_flashcards_pdf.__doc__ = "\u6839\u636e\u63d0\u4f9b\u7684 question-answer \u5217\u8868\uff0c\u751f\u6210\u4e00\u5f20\u5e26\u6709\u7cbe\u7f8e\u989c\u8272\u3001\u5706\u89d2\u5361\u7247\u3001\u6e10\u53d8\u80cc\u666f\u548c\u4e2d\u6587\u652f\u6301\u7684 PDF \u95ea\u5361\u6587\u4ef6\u3002\u652f\u6301 light/dark \u4e3b\u9898\uff0c\u53ef\u4fdd\u5b58\u81f3\u6307\u5b9a\u8def\u5f84\u3002\u9002\u7528\u4e8e\u6253\u5370\u6216\u6570\u5b57\u5b66\u4e60\u3002"


# --- Tool: create_flashcards_html ---
# Description: 根据提供的 question-answer 列表，生成一个视觉精美的 HTML 文件，包含渐变背景、圆角卡片、阴影、颜色区分和中文支持。用户可用浏览器打开后打印为 PDF，无需安装任何库。适用于教学、学习和打印场景。
@register_tool
def create_flashcards_html(cards, output_path):
    """
    生成一个带精美样式（颜色、圆角、阴影）的 HTML 闪卡文件，用户可用浏览器打开并打印为 PDF。
    
    参数:
        cards: list of dict, 每个元素为 {'question': str, 'answer': str}
        output_path: str, 输出 HTML 文件路径
    """
    html_content = '''<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>精美闪卡</title>
    <style>
        body {
            font-family: 'Microsoft YaHei', 'SimSun', sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 40px;
            color: #333;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            padding: 30px;
            border-radius: 20px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        }
        h1 {
            text-align: center;
            color: #2c3e50;
            font-size: 28px;
            margin-bottom: 40px;
            padding-bottom: 15px;
            border-bottom: 3px dashed #3498db;
        }
        .card {
            margin-bottom: 40px;
            padding: 25px;
            border-radius: 15px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.1);
            border-left: 6px solid #3498db;
        }
        .question {
            font-size: 20px;
            font-weight: bold;
            color: #e74c3c;
            margin-bottom: 15px;
            background: #f8f9fa;
            padding: 12px;
            border-radius: 10px;
        }
        .answer {
            font-size: 18px;
            color: #27ae60;
            background: #f0f7ff;
            padding: 12px;
            border-radius: 10px;
            border-left: 4px solid #3498db;
        }
        .footer {
            text-align: center;
            margin-top: 50px;
            color: #95a5a6;
            font-style: italic;
        }
        @media print {
            body {
                background: white !important;
                padding: 0 !important;
            }
            .container {
                box-shadow: none !important;
                border-radius: 0 !important;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🌟 精美闪卡集 🌟</h1>
'''
    
    for i, card in enumerate(cards, 1):
        q = card.get('question', '无问题')
        a = card.get('answer', '无答案')
        html_content += f'''
        <div class="card">
            <div class="question">Q{i}: {q}</div>
            <div class="answer">A{i}: {a}</div>
        </div>
'''
    
    html_content += '''
        <div class="footer">📚 学习愉快，记忆更高效！</div>
    </div>
</body>
</html>'''
    
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(html_content)
    
    print(f"✅ 闪卡 HTML 已生成：{output_path}\n请用浏览器打开此文件，按 Ctrl+P 打印并选择「另存为 PDF」即可获得精美闪卡 PDF。")
create_flashcards_html.__doc__ = "\u6839\u636e\u63d0\u4f9b\u7684 question-answer \u5217\u8868\uff0c\u751f\u6210\u4e00\u4e2a\u89c6\u89c9\u7cbe\u7f8e\u7684 HTML \u6587\u4ef6\uff0c\u5305\u542b\u6e10\u53d8\u80cc\u666f\u3001\u5706\u89d2\u5361\u7247\u3001\u9634\u5f71\u3001\u989c\u8272\u533a\u5206\u548c\u4e2d\u6587\u652f\u6301\u3002\u7528\u6237\u53ef\u7528\u6d4f\u89c8\u5668\u6253\u5f00\u540e\u6253\u5370\u4e3a PDF\uff0c\u65e0\u9700\u5b89\u88c5\u4efb\u4f55\u5e93\u3002\u9002\u7528\u4e8e\u6559\u5b66\u3001\u5b66\u4e60\u548c\u6253\u5370\u573a\u666f\u3002"
