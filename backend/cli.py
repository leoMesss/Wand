import sys
import json
import os
from openai import OpenAI

# Set encoding to utf-8 for stdin/stdout to handle Chinese characters correctly
sys.stdin.reconfigure(encoding='utf-8')
sys.stdout.reconfigure(encoding='utf-8')

def main():
    try:
        # Read all input from stdin
        input_str = sys.stdin.read()
        if not input_str:
            return

        request_data = json.loads(input_str)
        message = request_data.get('message')
        config = request_data.get('config', {})

        # 1. Extract Configuration
        api_key = config.get('apiKey')
        base_url = config.get('baseUrl')
        model = config.get('customModelId') or config.get('model') or 'gpt-3.5-turbo'
        temperature = float(config.get('temperature', 0.7))

        if not api_key:
            print(json.dumps({'error': 'Missing API Key. Please configure it in settings.'}))
            return

        # 2. Initialize OpenAI Client
        client = OpenAI(
            api_key=api_key,
            base_url=base_url if base_url else None
        )

        # 3. Call the LLM with streaming
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": "You are a helpful assistant."},
                {"role": "user", "content": message}
            ],
            temperature=temperature,
            stream=True
        )

        # 4. Output the result as JSON chunks
        for chunk in response:
            content = chunk.choices[0].delta.content
            if content:
                print(json.dumps({'chunk': content}))
                sys.stdout.flush()

    except Exception as e:
        # Output error as JSON
        print(json.dumps({'error': str(e)}))
        sys.stdout.flush()

if __name__ == '__main__':
    main()
