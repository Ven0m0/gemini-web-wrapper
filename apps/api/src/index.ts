import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { serveStatic } from 'hono/bun';
import { getSettings, resolveModel } from './config/settings';
import { ProviderFactory } from './llm-core';
import type { LLMProvider } from './llm-core';
import { 
  ChatCompletionRequestSchema,
  type ChatCompletionResponse,
  type ChatCompletionChunk,
} from './models/openai-schemas';
import { v4 as uuidv4 } from 'uuid';

const app = new Hono();
const settings = getSettings();

let llmProvider: LLMProvider | null = null;

function getLLMProvider(): LLMProvider {
  if (!llmProvider) {
    llmProvider = ProviderFactory.create({
      provider: settings.modelProvider,
      apiKey: settings.modelProvider === 'anthropic' ? settings.anthropicApiKey : settings.googleApiKey,
      modelName: settings.modelName || undefined,
    });
  }
  return llmProvider;
}

app.use('*', logger());
app.use('*', cors({
  origin: settings.corsAllowOrigins.split(',').map(s => s.trim()),
  allowMethods: settings.corsAllowMethods.split(',').map(s => s.trim()),
  allowHeaders: settings.corsAllowHeaders.split(',').map(s => s.trim()),
  credentials: settings.corsAllowCredentials,
}));

app.get('/health', (c) => c.json({ ok: true }));

app.get('/v1/models', (c) => {
  return c.json({
    data: [
      { id: 'gemini-2.5-flash', object: 'model', created: 1677610602, owned_by: 'google' },
      { id: 'gemini-2.5-pro', object: 'model', created: 1677610602, owned_by: 'google' },
      { id: 'gemini-3.0-pro', object: 'model', created: 1677610602, owned_by: 'google' },
    ],
  });
});

app.post('/v1/chat/completions', async (c) => {
  const body = await c.req.json();
  const request = ChatCompletionRequestSchema.parse(body);
  const provider = getLLMProvider();
  const modelName = resolveModel(request.model);
  const requestId = `chatcmpl-${uuidv4().replace(/-/g, '')}`;
  const created = Math.floor(Date.now() / 1000);

  const prompt = request.messages
    .map(m => {
      if (typeof m.content === 'string') return m.content;
      if (Array.isArray(m.content)) {
        return m.content
          .filter(c => c.type === 'text')
          .map(c => 'text' in c ? c.text : '')
          .join('\n');
      }
      return '';
    })
    .join('\n');

  const systemMessage = request.messages.find(m => m.role === 'system');
  const system = typeof systemMessage?.content === 'string' ? systemMessage.content : undefined;

  const history = request.messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role,
      content: typeof m.content === 'string' ? m.content : '',
    }));

  if (request.stream) {
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        
        try {
          for await (const chunk of provider.stream(prompt, { system, history })) {
            const delta = { content: chunk };
            const chunkData: ChatCompletionChunk = {
              id: requestId,
              object: 'chat.completion.chunk',
              created,
              model: modelName,
              choices: [{ index: 0, delta, finishReason: null }],
            };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunkData)}\n\n`));
          }
          
          const finishChunk: ChatCompletionChunk = {
            id: requestId,
            object: 'chat.completion.chunk',
            created,
            model: modelName,
            choices: [{ index: 0, delta: {}, finishReason: 'stop' }],
          };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(finishChunk)}\n\n`));
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  }

  const text = await provider.generate(prompt, { system, history });
  
  const response: ChatCompletionResponse = {
    id: requestId,
    object: 'chat.completion',
    created,
    model: modelName,
    choices: [{
      index: 0,
      message: { role: 'assistant', content: text },
      finishReason: 'stop',
    }],
    usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
  };

  return c.json(response);
});

app.post('/chat', async (c) => {
  const body = await c.req.json();
  const { prompt, system } = body;
  const provider = getLLMProvider();
  const text = await provider.generate(prompt, { system });
  return c.json({ text });
});

app.post('/code', async (c) => {
  const body = await c.req.json();
  const { code, instruction } = body;
  const provider = getLLMProvider();
  
  const prompt = [
    'You are a coding assistant.',
    'Apply the following instruction to the code.',
    '',
    'Instruction:',
    instruction,
    '',
    'Code:',
    code,
  ].join('\n');
  
  const text = await provider.generate(prompt);
  return c.json({ text });
});

app.post('/chatbot', async (c) => {
  const body = await c.req.json();
  const { message, history, system } = body;
  const provider = getLLMProvider();
  
  const text = await provider.generate(message, {
    system,
    history: history?.map((m: { role: string; content: string }) => ({
      role: m.role,
      content: m.content,
    })),
  });
  
  return c.json({ text });
});

app.post('/chatbot/stream', async (c) => {
  const body = await c.req.json();
  const { message, history, system } = body;
  const provider = getLLMProvider();

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      
      try {
        for await (const chunk of provider.stream(message, {
          system,
          history: history?.map((m: { role: string; content: string }) => ({
            role: m.role,
            content: m.content,
          })),
        })) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain',
      'Cache-Control': 'no-cache',
    },
  });
});

app.get('/profiles/list', async (c) => {
  return c.json({ profiles: [], currentProfile: null, count: 0 });
});

app.post('/profiles/switch', async (c) => {
  const body = await c.req.json();
  return c.json({ status: 'success', message: `Switched to profile '${body.name}'` });
});

app.delete('/profiles/:name', async (c) => {
  const name = c.req.param('name');
  return c.json({ status: 'success', message: `Profile '${name}' deleted` });
});

app.post('/profiles/:name/refresh', async (c) => {
  const name = c.req.param('name');
  return c.json({ status: 'success', message: `Profile '${name}' refreshed` });
});

app.post('/gemini/chat', async (c) => {
  const body = await c.req.json();
  const provider = getLLMProvider();
  const text = await provider.generate(body.message);
  return c.json({ text, conversationId: null, profile: null });
});

app.post('/github/file/read', async (c) => {
  return c.json({ error: 'GitHub integration not yet implemented' }, 501);
});

app.post('/github/file/write', async (c) => {
  return c.json({ error: 'GitHub integration not yet implemented' }, 501);
});

app.post('/github/list', async (c) => {
  return c.json({ error: 'GitHub integration not yet implemented' }, 501);
});

app.post('/github/branches', async (c) => {
  return c.json({ error: 'GitHub integration not yet implemented' }, 501);
});

app.post('/memory/session/new', async (c) => {
  return c.json({ status: 'success', message: 'New session created', sessionId: uuidv4() });
});

app.post('/memory/query', async (c) => {
  return c.json({ sessions: [], count: 0 });
});

app.get('/tools/composio/list', async (c) => {
  const { getComposioService } = await import('./services');
  const composio = getComposioService();
  
  if (!composio.isAvailable()) {
    return c.json({ error: 'Composio API key not configured' }, 503);
  }
  
  try {
    const tools = await composio.listTools();
    return c.json({ tools, count: tools.length });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});

app.post('/tools/composio/execute', async (c) => {
  const { getComposioService } = await import('./services');
  const composio = getComposioService();
  
  if (!composio.isAvailable()) {
    return c.json({ error: 'Composio API key not configured' }, 503);
  }
  
  const body = await c.req.json();
  
  try {
    const result = await composio.executeTool({
      toolName: body.toolName,
      arguments: body.arguments || {},
    });
    return c.json(result);
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});

app.use('/*', serveStatic({ root: settings.frontendDistDir }));

const port = settings.port;
console.log(`Server starting on http://${settings.host}:${port}`);

export default {
  port,
  hostname: settings.host,
  fetch: app.fetch,
};

export { app };
