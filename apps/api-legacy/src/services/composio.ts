export interface ComposioTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ComposioToolExecution {
  toolName: string;
  arguments: Record<string, unknown>;
}

export interface ComposioToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export class ComposioService {
  private apiKey: string | null;
  private baseUrl = 'https://api.composio.dev';

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.COMPOSIO_API_KEY || null;
  }

  isAvailable(): boolean {
    return this.apiKey !== null;
  }

  async listTools(): Promise<ComposioTool[]> {
    if (!this.apiKey) {
      throw new Error('Composio API key not configured');
    }

    const response = await fetch(`${this.baseUrl}/tools`, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Composio API error: ${response.status}`);
    }

    const data = await response.json() as { tools?: Array<Record<string, unknown>> };
    
    return (data.tools || []).map((tool) => ({
      name: tool.name as string,
      description: tool.description as string,
      parameters: tool.parameters as Record<string, unknown>,
    }));
  }

  async executeTool(execution: ComposioToolExecution): Promise<ComposioToolResult> {
    if (!this.apiKey) {
      throw new Error('Composio API key not configured');
    }

    const response = await fetch(`${this.baseUrl}/tools/execute`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tool: execution.toolName,
        arguments: execution.arguments,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return {
        success: false,
        error: `Composio API error: ${response.status} - ${error}`,
      };
    }

    const data = await response.json() as { result?: unknown };
    
    return {
      success: true,
      data: data.result,
    };
  }
}

let composioService: ComposioService | null = null;

export function getComposioService(): ComposioService {
  if (!composioService) {
    composioService = new ComposioService();
  }
  return composioService;
}
