# Frontend Chat Integration Guide

This guide explains how to integrate the `/chat` endpoint with MCP tool support on your frontend.

## Authentication

The `/chat` endpoint requires authentication via:
- **API Key**: Pass in `Authorization: Bearer <api-key>` header
- **Password** (optional): Pass in `X-Credential-Password: <password>` header for MCP credential access

## Request Format

```typescript
POST /chat
Content-Type: application/json
Authorization: Bearer re_xxxxx
X-Credential-Password: your-password (optional)

{
  "messages": [
    { "role": "user", "content": "Search for stripe payment abilities" },
    { "role": "assistant", "content": "I found 5 stripe abilities..." },
    { "role": "user", "content": "Execute the first one" }
  ]
}
```

## Response Format

The response is a **Server-Sent Events (SSE)** stream with `Content-Type: text/event-stream`.

### Event Types

#### 1. Connection Established
```
: connected
```
This is a comment line sent immediately when the connection opens.

#### 2. Text Chunks
```
data: {"text":"Hello"}

data: {"text":" there"}
```
Each token/chunk is sent as a separate SSE event with JSON payload containing the `text` field.

#### 3. Tool Calls
When the agent uses MCP tools, you'll receive events like:
```
data: {"type":"tool_call","tool":"unbrowseMCP_search_abilities","args":{"query":"stripe","limit":10}}

data: {"type":"tool_result","tool":"unbrowseMCP_search_abilities","result":{...}}
```

#### 4. Stream Complete
```
data: [DONE]
```
Indicates the stream has finished.

## Frontend Implementation

### React Example with EventSource

```typescript
import { useState, useEffect } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ToolCall {
  tool: string;
  args: Record<string, any>;
  result?: any;
}

export function ChatComponent() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentResponse, setCurrentResponse] = useState('');
  const [toolCalls, setToolCalls] = useState<ToolCall[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  const sendMessage = async (userMessage: string) => {
    // Add user message
    const newMessages = [...messages, { role: 'user' as const, content: userMessage }];
    setMessages(newMessages);
    setCurrentResponse('');
    setToolCalls([]);
    setIsStreaming(true);

    try {
      const response = await fetch('http://localhost:4111/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${yourApiKey}`,
          'X-Credential-Password': yourPassword, // Optional
        },
        body: JSON.stringify({ messages: newMessages }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader!.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (!line.trim() || line.startsWith(':')) continue; // Skip empty lines and comments

          if (line.startsWith('data: ')) {
            const data = line.slice(6); // Remove "data: " prefix

            if (data === '[DONE]') {
              // Stream finished
              setMessages(prev => [...prev, {
                role: 'assistant',
                content: currentResponse
              }]);
              setCurrentResponse('');
              setIsStreaming(false);
              continue;
            }

            try {
              const parsed = JSON.parse(data);

              if (parsed.text) {
                // Text chunk
                setCurrentResponse(prev => prev + parsed.text);
              } else if (parsed.type === 'tool_call') {
                // Tool is being called
                console.log('Tool call:', parsed.tool, parsed.args);
                setToolCalls(prev => [...prev, {
                  tool: parsed.tool,
                  args: parsed.args,
                }]);
              } else if (parsed.type === 'tool_result') {
                // Tool result received
                console.log('Tool result:', parsed.tool, parsed.result);
                setToolCalls(prev => prev.map(tc =>
                  tc.tool === parsed.tool
                    ? { ...tc, result: parsed.result }
                    : tc
                ));
              }
            } catch (e) {
              console.error('Failed to parse SSE data:', data, e);
            }
          }
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
      setIsStreaming(false);
    }
  };

  return (
    <div className="chat-container">
      <div className="messages">
        {messages.map((msg, idx) => (
          <div key={idx} className={`message ${msg.role}`}>
            {msg.content}
          </div>
        ))}

        {/* Show current streaming response */}
        {currentResponse && (
          <div className="message assistant streaming">
            {currentResponse}
            <span className="cursor">▊</span>
          </div>
        )}

        {/* Show active tool calls */}
        {toolCalls.length > 0 && (
          <div className="tool-calls">
            {toolCalls.map((tc, idx) => (
              <div key={idx} className="tool-call">
                <div className="tool-name">🔧 {tc.tool}</div>
                <div className="tool-args">
                  {JSON.stringify(tc.args, null, 2)}
                </div>
                {tc.result && (
                  <div className="tool-result">
                    ✓ Result: {JSON.stringify(tc.result).slice(0, 100)}...
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <input
        type="text"
        onKeyPress={(e) => {
          if (e.key === 'Enter' && !isStreaming) {
            sendMessage(e.currentTarget.value);
            e.currentTarget.value = '';
          }
        }}
        disabled={isStreaming}
        placeholder="Type a message..."
      />
    </div>
  );
}
```

### Using EventSource API (Alternative)

```typescript
function streamChat(messages: Message[], apiKey: string, password?: string) {
  return new Promise<string>((resolve, reject) => {
    // EventSource doesn't support POST, so we need to use fetch
    // This is just for reference - use the fetch approach above

    fetch('http://localhost:4111/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'X-Credential-Password': password || '',
      },
      body: JSON.stringify({ messages }),
    }).then(response => {
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';

      function read() {
        reader.read().then(({ done, value }) => {
          if (done) {
            resolve(fullResponse);
            return;
          }

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') {
                resolve(fullResponse);
                return;
              }
              try {
                const parsed = JSON.parse(data);
                if (parsed.text) {
                  fullResponse += parsed.text;
                }
              } catch (e) {
                // Ignore parse errors
              }
            }
          }

          read(); // Continue reading
        });
      }

      read();
    }).catch(reject);
  });
}
```

### Vue.js Example

```vue
<template>
  <div class="chat">
    <div v-for="(msg, idx) in messages" :key="idx" :class="['message', msg.role]">
      {{ msg.content }}
    </div>

    <div v-if="currentResponse" class="message assistant streaming">
      {{ currentResponse }}<span class="cursor">▊</span>
    </div>

    <div v-if="toolCalls.length > 0" class="tool-calls">
      <div v-for="(tc, idx) in toolCalls" :key="idx" class="tool-call">
        <div class="tool-name">🔧 {{ tc.tool }}</div>
        <pre>{{ JSON.stringify(tc.args, null, 2) }}</pre>
        <div v-if="tc.result" class="tool-result">
          ✓ Completed
        </div>
      </div>
    </div>

    <input
      v-model="input"
      @keypress.enter="sendMessage"
      :disabled="isStreaming"
      placeholder="Type a message..."
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const messages = ref<Array<{role: string, content: string}>>([]);
const currentResponse = ref('');
const toolCalls = ref<Array<any>>([]);
const isStreaming = ref(false);
const input = ref('');

async function sendMessage() {
  if (!input.value.trim() || isStreaming.value) return;

  const userMessage = input.value;
  input.value = '';

  messages.value.push({ role: 'user', content: userMessage });
  currentResponse.value = '';
  toolCalls.value = [];
  isStreaming.value = true;

  try {
    const response = await fetch('http://localhost:4111/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${yourApiKey}`,
        'X-Credential-Password': yourPassword,
      },
      body: JSON.stringify({ messages: messages.value }),
    });

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim() || line.startsWith(':')) continue;

        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') {
            messages.value.push({
              role: 'assistant',
              content: currentResponse.value
            });
            currentResponse.value = '';
            isStreaming.value = false;
            continue;
          }

          try {
            const parsed = JSON.parse(data);
            if (parsed.text) {
              currentResponse.value += parsed.text;
            } else if (parsed.type === 'tool_call') {
              toolCalls.value.push({ tool: parsed.tool, args: parsed.args });
            } else if (parsed.type === 'tool_result') {
              const tc = toolCalls.value.find(t => t.tool === parsed.tool);
              if (tc) tc.result = parsed.result;
            }
          } catch (e) {
            console.error('Parse error:', e);
          }
        }
      }
    }
  } catch (error) {
    console.error('Chat error:', error);
    isStreaming.value = false;
  }
}
</script>
```

## Available MCP Tools

When the chat agent has access to MCP tools, it can call tools like:

- `unbrowseMCP_search_abilities` - Search for abilities by query
- `unbrowseMCP_get_ability` - Get details of a specific ability
- `unbrowseMCP_execute_ability` - Execute an ability with parameters
- And more depending on your MCP server configuration

## Tool Call Detection

To detect when tools are being called and show UI indicators:

```typescript
interface ToolCall {
  tool: string;
  args: Record<string, any>;
  status: 'calling' | 'completed' | 'error';
  result?: any;
  error?: string;
}

function ToolCallIndicator({ toolCall }: { toolCall: ToolCall }) {
  return (
    <div className="tool-call-indicator">
      <div className="tool-header">
        {toolCall.status === 'calling' && <Spinner />}
        {toolCall.status === 'completed' && <CheckIcon />}
        {toolCall.status === 'error' && <ErrorIcon />}
        <span className="tool-name">{toolCall.tool}</span>
      </div>

      {toolCall.status === 'calling' && (
        <div className="tool-args">
          Searching with: {JSON.stringify(toolCall.args)}
        </div>
      )}

      {toolCall.status === 'completed' && toolCall.result && (
        <div className="tool-result">
          Found {toolCall.result.count} results
        </div>
      )}

      {toolCall.status === 'error' && (
        <div className="tool-error">
          Error: {toolCall.error}
        </div>
      )}
    </div>
  );
}
```

## Error Handling

```typescript
try {
  const response = await fetch('/chat', { ... });

  if (!response.ok) {
    const error = await response.json();
    console.error('API error:', error);
    // Handle error in UI
    return;
  }

  // Process stream...
} catch (error) {
  if (error instanceof TypeError) {
    // Network error
    console.error('Network error:', error);
  } else {
    // Other errors
    console.error('Unexpected error:', error);
  }
}
```

## Tips

1. **Buffering**: Always buffer incomplete lines when parsing SSE streams
2. **Error Recovery**: Implement retry logic for network errors
3. **Memory Management**: Clear old messages to prevent memory leaks
4. **UX**: Show loading indicators when tools are being called
5. **Accessibility**: Announce new messages to screen readers
6. **Mobile**: Test on mobile devices - SSE works differently on some mobile browsers

## Testing

Test the endpoint with curl:

```bash
curl -N -X POST 'http://localhost:4111/chat' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer re_xxxxx' \
  -H 'X-Credential-Password: meowmeow' \
  -d '{
    "messages": [
      {"role": "user", "content": "Search for stripe abilities"}
    ]
  }'
```

You should see output like:
```
: connected

data: {"text":"I'll"}

data: {"text":" search"}

data: {"text":" for"}

...

data: [DONE]
```
