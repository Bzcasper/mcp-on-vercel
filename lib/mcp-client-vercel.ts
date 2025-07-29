/**
 * Vercel-Compatible TypeScript MCP Client SDK
 * 
 * Optimized for serverless environments with fetch-based HTTP transport
 * and browser-compatible APIs. No Node.js dependencies.
 */

export interface MCPMessage {
  jsonrpc: string;
  id?: string | number;
  timestamp?: string;
}

export interface MCPRequest extends MCPMessage {
  method: string;
  params?: Record<string, any>;
}

export interface MCPResponse extends MCPMessage {
  result?: any;
  error?: MCPError;
}

export interface MCPError {
  code: number;
  message: string;
  data?: Record<string, any>;
}

export interface MCPTool {
  name: string;
  description: string;
  input_schema: Record<string, any>;
  output_schema?: Record<string, any>;
  category?: string;
  version?: string;
}

export interface MCPClientConfig {
  serverUrl: string;
  authType?: 'api_key' | 'jwt' | 'bearer';
  apiKey?: string;
  token?: string;
  
  // Request settings
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
  
  // Cache settings
  enableCaching?: boolean;
  cacheTtl?: number;
}

export enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  FAILED = 'failed'
}

/**
 * HTTP-based MCP Client for Vercel/Serverless environments
 */
export class VercelMCPClient {
  private config: Required<MCPClientConfig>;
  private cache: Map<string, { result: any; timestamp: number }> = new Map();
  private availableTools: MCPTool[] = [];
  private state: ConnectionState = ConnectionState.DISCONNECTED;

  constructor(config: MCPClientConfig) {
    this.config = {
      authType: 'api_key',
      timeout: 30000,
      maxRetries: 3,
      retryDelay: 1000,
      enableCaching: true,
      cacheTtl: 300000, // 5 minutes for serverless
      ...config
    };
  }

  /**
   * Initialize client and test connection
   */
  async connect(): Promise<boolean> {
    try {
      this.state = ConnectionState.CONNECTING;
      
      // Test connection with a simple status request
      const response = await this.makeRequest({
        jsonrpc: '2.0',
        method: 'server/status',
        id: this.generateRequestId()
      });

      if (response.error) {
        console.error('MCP connection failed:', response.error.message);
        this.state = ConnectionState.FAILED;
        return false;
      }

      this.state = ConnectionState.CONNECTED;
      
      // Load available tools
      await this.loadTools();
      
      return true;
    } catch (error) {
      console.error('Failed to connect to MCP server:', error);
      this.state = ConnectionState.FAILED;
      return false;
    }
  }

  /**
   * Call an MCP tool with parameters
   */
  async callTool(
    toolName: string, 
    parameters: Record<string, any>, 
    useCache = true
  ): Promise<any> {
    if (this.state !== ConnectionState.CONNECTED) {
      throw new Error('MCP client not connected. Call connect() first.');
    }

    // Check cache first
    if (useCache && this.config.enableCaching) {
      const cacheKey = this.getCacheKey(toolName, parameters);
      const cachedResult = this.getCachedResult(cacheKey);
      if (cachedResult) {
        return cachedResult;
      }
    }

    const request: MCPRequest = {
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: parameters
      },
      id: this.generateRequestId()
    };

    const response = await this.makeRequestWithRetry(request);

    if (response.error) {
      throw new Error(`Tool call failed: ${response.error.message}`);
    }

    const result = response.result;

    // Cache successful results
    if (useCache && this.config.enableCaching) {
      const cacheKey = this.getCacheKey(toolName, parameters);
      this.cacheResult(cacheKey, result);
    }

    return result;
  }

  /**
   * List available tools
   */
  async listTools(): Promise<MCPTool[]> {
    if (this.availableTools.length > 0) {
      return this.availableTools;
    }

    await this.loadTools();
    return this.availableTools;
  }

  /**
   * Get server status
   */
  async getServerStatus(): Promise<any> {
    const request: MCPRequest = {
      jsonrpc: '2.0',
      method: 'server/status',
      id: this.generateRequestId()
    };

    const response = await this.makeRequestWithRetry(request);

    if (response.error) {
      throw new Error(`Status check failed: ${response.error.message}`);
    }

    return response.result;
  }

  /**
   * Check if client is connected
   */
  get isConnected(): boolean {
    return this.state === ConnectionState.CONNECTED;
  }

  /**
   * Get current connection state
   */
  get connectionState(): ConnectionState {
    return this.state;
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  private async loadTools(): Promise<void> {
    try {
      const request: MCPRequest = {
        jsonrpc: '2.0',
        method: 'tools/list',
        id: this.generateRequestId()
      };

      const response = await this.makeRequestWithRetry(request);

      if (response.error) {
        console.error('Failed to load tools:', response.error.message);
        return;
      }

      this.availableTools = response.result?.tools || [];
      console.log(`Loaded ${this.availableTools.length} MCP tools`);
    } catch (error) {
      console.error('Error loading tools:', error);
    }
  }

  private async makeRequestWithRetry(request: MCPRequest): Promise<MCPResponse> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          await this.sleep(this.config.retryDelay * attempt);
        }

        return await this.makeRequest(request);
      } catch (error) {
        lastError = error as Error;
        console.warn(`Request attempt ${attempt + 1} failed:`, error);
      }
    }

    throw lastError || new Error('All retry attempts failed');
  }

  private async makeRequest(request: MCPRequest): Promise<MCPResponse> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    // Add authentication headers
    if (this.config.authType === 'api_key' && this.config.apiKey) {
      headers['X-API-Key'] = this.config.apiKey;
    } else if (this.config.authType === 'bearer' && this.config.token) {
      headers['Authorization'] = `Bearer ${this.config.token}`;
    } else if (this.config.authType === 'jwt' && this.config.token) {
      headers['Authorization'] = `JWT ${this.config.token}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(this.config.serverUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(request),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return this.validateResponse(data);
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timeout after ${this.config.timeout}ms`);
      }
      
      throw error;
    }
  }

  private validateResponse(data: any): MCPResponse {
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid response format');
    }
    
    if (data.jsonrpc !== '2.0') {
      throw new Error('Invalid JSON-RPC version');
    }
    
    return data as MCPResponse;
  }

  private getCacheKey(toolName: string, parameters: Record<string, any>): string {
    const keyData = `${toolName}:${JSON.stringify(parameters, Object.keys(parameters).sort())}`;
    
    // Simple hash function for browser compatibility
    let hash = 0;
    for (let i = 0; i < keyData.length; i++) {
      const char = keyData.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return hash.toString(36);
  }

  private getCachedResult(cacheKey: string): any | null {
    const cached = this.cache.get(cacheKey);
    if (!cached) {
      return null;
    }

    if (Date.now() - cached.timestamp > this.config.cacheTtl) {
      this.cache.delete(cacheKey);
      return null;
    }

    return cached.result;
  }

  private cacheResult(cacheKey: string, result: any): void {
    this.cache.set(cacheKey, {
      result,
      timestamp: Date.now()
    });

    // Simple cache cleanup for memory management
    if (this.cache.size > 100) {
      const oldestKey = Array.from(this.cache.entries())
        .sort(([,a], [,b]) => a.timestamp - b.timestamp)[0][0];
      this.cache.delete(oldestKey);
    }
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Convenience function to create and connect an MCP client
 */
export async function createVercelMCPClient(
  serverUrl: string,
  options: Partial<MCPClientConfig> = {}
): Promise<VercelMCPClient> {
  const config: MCPClientConfig = {
    serverUrl,
    ...options
  };

  const client = new VercelMCPClient(config);
  
  const connected = await client.connect();
  if (!connected) {
    throw new Error('Failed to connect to MCP server');
  }

  return client;
}

/**
 * Environment variable helper for Vercel deployment
 */
export function getMCPConfigFromEnv(): Partial<MCPClientConfig> {
  const config: Partial<MCPClientConfig> = {};

  // Try to get config from environment variables
  if (typeof process !== 'undefined' && process.env) {
    config.serverUrl = process.env.MCP_SERVER_URL;
    config.apiKey = process.env.MCP_API_KEY;
    config.token = process.env.MCP_TOKEN;
    
    if (process.env.MCP_AUTH_TYPE) {
      config.authType = process.env.MCP_AUTH_TYPE as 'api_key' | 'jwt' | 'bearer';
    }
    
    if (process.env.MCP_TIMEOUT) {
      config.timeout = parseInt(process.env.MCP_TIMEOUT, 10);
    }
  }

  return config;
}