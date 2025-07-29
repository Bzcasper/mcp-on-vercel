/**
 * Unified MCP Server Implementation
 * 
 * Combines MoneyPrinterTurbo video generation capabilities with Supabase database tools
 * in a single Vercel-compatible serverless endpoint with shared authentication and configuration.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

// Optional Supabase import for environments where it's available
let createClient: any = null;
try {
  const supabaseModule = require('@supabase/supabase-js');
  createClient = supabaseModule.createClient;
} catch (error) {
  console.warn('Supabase client not available - some tools will be disabled');
}

// Core MCP Protocol types
interface MCPRequest {
  jsonrpc: '2.0';
  id?: string | number;
  method: string;
  params?: any;
}

interface MCPResponse {
  jsonrpc: '2.0';
  id?: string | number;
  result?: any;
  error?: MCPError;
}

interface MCPError {
  code: number;
  message: string;
  data?: any;
}

interface MCPTool {
  name: string;
  description: string;
  inputSchema: any;
  outputSchema?: any;
  category: string;
}

// Environment validation
const validateEnvironment = () => {
  const requiredVars = ['SUPABASE_URL', 'SUPABASE_ANON_KEY'];
  const missing = requiredVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
};

// Error codes following MCP specification
const MCP_ERRORS = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  SERVER_ERROR: -32000,
  AUTHENTICATION_ERROR: -32001,
  RATE_LIMIT_EXCEEDED: -32002
} as const;

/**
 * Tool Registry - Manages all available MCP tools
 */
class MCPToolRegistry {
  private tools: Map<string, MCPTool> = new Map();
  private handlers: Map<string, Function> = new Map();

  registerTool(tool: MCPTool, handler: Function): void {
    this.tools.set(tool.name, tool);
    this.handlers.set(tool.name, handler);
  }

  getTool(name: string): MCPTool | undefined {
    return this.tools.get(name);
  }

  getAllTools(): MCPTool[] {
    return Array.from(this.tools.values());
  }

  async executeTool(name: string, params: any, context: any): Promise<any> {
    const handler = this.handlers.get(name);
    if (!handler) {
      throw new Error(`Tool '${name}' not found`);
    }
    return await handler(params, context);
  }

  getToolsByCategory(category: string): MCPTool[] {
    return Array.from(this.tools.values()).filter(tool => tool.category === category);
  }
}

/**
 * Authentication Manager
 */
class MCPAuthManager {
  validateApiKey(apiKey: string): boolean {
    // For demo purposes - in production, validate against your auth system
    return !!(apiKey && apiKey.length > 10);
  }

  validateJWT(token: string): boolean {
    // JWT validation logic would go here
    return !!(token && token.startsWith('eyJ'));
  }

  extractAuthFromRequest(req: VercelRequest): { type: string; credential: string } | null {
    const authHeader = req.headers.authorization;
    if (!authHeader) return null;

    if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      if (token.startsWith('eyJ')) {
        return { type: 'jwt', credential: token };
      } else {
        return { type: 'api_key', credential: token };
      }
    }

    return null;
  }
}

/**
 * Supabase Tools Implementation
 */
class SupabaseToolsProvider {
  private supabase: any;

  constructor() {
    validateEnvironment();
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!,
      {
        auth: { persistSession: false }
      }
    );
  }

  registerTools(registry: MCPToolRegistry): void {
    // Register Supabase tools
    registry.registerTool({
      name: 'supabase_query',
      description: 'Execute a SQL query on Supabase database',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'SQL query to execute' },
          params: { type: 'array', description: 'Query parameters' }
        },
        required: ['query']
      },
      category: 'database'
    }, this.executeQuery.bind(this));

    registry.registerTool({
      name: 'supabase_select',
      description: 'Select data from a Supabase table',
      inputSchema: {
        type: 'object',
        properties: {
          table: { type: 'string', description: 'Table name' },
          columns: { type: 'string', description: 'Columns to select', default: '*' },
          where: { type: 'object', description: 'Where conditions' },
          limit: { type: 'number', description: 'Limit results' }
        },
        required: ['table']
      },
      category: 'database'
    }, this.selectData.bind(this));

    registry.registerTool({
      name: 'supabase_insert',
      description: 'Insert data into a Supabase table',
      inputSchema: {
        type: 'object',
        properties: {
          table: { type: 'string', description: 'Table name' },
          data: { type: 'object', description: 'Data to insert' }
        },
        required: ['table', 'data']
      },
      category: 'database'
    }, this.insertData.bind(this));

    registry.registerTool({
      name: 'supabase_update',
      description: 'Update data in a Supabase table',
      inputSchema: {
        type: 'object',
        properties: {
          table: { type: 'string', description: 'Table name' },
          data: { type: 'object', description: 'Data to update' },
          where: { type: 'object', description: 'Where conditions' }
        },
        required: ['table', 'data', 'where']
      },
      category: 'database'
    }, this.updateData.bind(this));
  }

  private async executeQuery(params: any, context: any): Promise<any> {
    try {
      const { query, params: queryParams } = params;
      const { data, error } = await this.supabase.rpc('execute_sql', {
        query,
        params: queryParams || []
      });

      if (error) throw new Error(`Supabase query error: ${error.message}`);
      return { success: true, data };
    } catch (error) {
      throw new Error(`Failed to execute query: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async selectData(params: any, context: any): Promise<any> {
    try {
      const { table, columns = '*', where, limit } = params;
      let query = this.supabase.from(table).select(columns);
      
      if (where) {
        Object.entries(where).forEach(([key, value]) => {
          query = query.eq(key, value);
        });
      }

      if (limit) query = query.limit(limit);
      
      const { data, error } = await query;
      if (error) throw new Error(`Supabase select error: ${error.message}`);
      
      return { success: true, data };
    } catch (error) {
      throw new Error(`Failed to select data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async insertData(params: any, context: any): Promise<any> {
    try {
      const { table, data } = params;
      const { data: result, error } = await this.supabase
        .from(table)
        .insert(data)
        .select();

      if (error) throw new Error(`Supabase insert error: ${error.message}`);
      return { success: true, data: result };
    } catch (error) {
      throw new Error(`Failed to insert data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async updateData(params: any, context: any): Promise<any> {
    try {
      const { table, data, where } = params;
      let query = this.supabase.from(table).update(data);
      
      Object.entries(where).forEach(([key, value]) => {
        query = query.eq(key, value);
      });

      const { data: result, error } = await query.select();
      if (error) throw new Error(`Supabase update error: ${error.message}`);
      
      return { success: true, data: result };
    } catch (error) {
      throw new Error(`Failed to update data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

/**
 * MoneyPrinterTurbo Tools Implementation
 */
class MoneyPrinterToolsProvider {
  registerTools(registry: MCPToolRegistry): void {
    // Register video generation tools
    registry.registerTool({
      name: 'generate_video_script',
      description: 'Generate a video script based on a subject and parameters',
      inputSchema: {
        type: 'object',
        properties: {
          video_subject: { type: 'string', description: 'The subject/topic for the video' },
          language: { type: 'string', description: 'Language for the script', default: '' },
          paragraph_number: { 
            type: 'integer', 
            description: 'Number of paragraphs', 
            default: 1, 
            minimum: 1, 
            maximum: 10 
          }
        },
        required: ['video_subject']
      },
      category: 'video_generation'
    }, this.generateScript.bind(this));

    registry.registerTool({
      name: 'generate_video_terms',
      description: 'Generate search terms for finding relevant video materials',
      inputSchema: {
        type: 'object',
        properties: {
          video_subject: { type: 'string', description: 'The video subject' },
          video_script: { type: 'string', description: 'The video script content' },
          amount: { 
            type: 'integer', 
            description: 'Number of search terms', 
            default: 5, 
            minimum: 1, 
            maximum: 20 
          }
        },
        required: ['video_subject', 'video_script']
      },
      category: 'video_generation'
    }, this.generateTerms.bind(this));

    registry.registerTool({
      name: 'create_video',
      description: 'Create a complete video with script, voice, and visual elements',
      inputSchema: {
        type: 'object',
        properties: {
          video_subject: { type: 'string', description: 'The video subject/topic' },
          video_script: { type: 'string', description: 'Pre-written script (optional)' },
          video_aspect: { 
            type: 'string', 
            enum: ['16:9', '9:16', '1:1'], 
            description: 'Video aspect ratio', 
            default: '9:16' 
          },
          voice_name: { type: 'string', description: 'Voice to use for narration' },
          bgm_type: { type: 'string', description: 'Background music type', default: 'random' },
          subtitle_enabled: { type: 'boolean', description: 'Enable subtitles', default: true }
        },
        required: ['video_subject']
      },
      category: 'video_generation'
    }, this.createVideo.bind(this));

    registry.registerTool({
      name: 'synthesize_voice',
      description: 'Convert text to speech using various voice options',
      inputSchema: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'Text to convert to speech' },
          voice_name: { type: 'string', description: 'Voice to use for synthesis' },
          voice_rate: { 
            type: 'number', 
            description: 'Speech rate (0.5-2.0)', 
            default: 1.0, 
            minimum: 0.5, 
            maximum: 2.0 
          },
          voice_volume: { 
            type: 'number', 
            description: 'Voice volume (0.0-1.0)', 
            default: 1.0, 
            minimum: 0.0, 
            maximum: 1.0 
          }
        },
        required: ['text', 'voice_name']
      },
      category: 'audio_generation'
    }, this.synthesizeVoice.bind(this));
  }

  private async generateScript(params: any, context: any): Promise<any> {
    try {
      const { video_subject, language = '', paragraph_number = 1 } = params;
      
      // Mock implementation - in real use, this would call AI service
      const script = `Generated script for "${video_subject}" with ${paragraph_number} paragraphs in ${language || 'English'}. This is a comprehensive video script that covers the key aspects of the topic with engaging content suitable for video production.`;
      
      const wordCount = script.split(' ').length;
      const estimatedDuration = wordCount * 0.5; // 2 words per second
      
      return {
        script,
        word_count: wordCount,
        estimated_duration: estimatedDuration,
        language: language || 'English',
        subject: video_subject
      };
    } catch (error) {
      throw new Error(`Failed to generate script: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async generateTerms(params: any, context: any): Promise<any> {
    try {
      const { video_subject, video_script, amount = 5 } = params;
      
      // Mock implementation - extract key terms from subject and script
      const baseTerms = video_subject.toLowerCase().split(' ');
      const terms = Array.from({ length: amount }, (_, i) => 
        `${baseTerms[0] || 'video'}_term_${i + 1}`
      );
      
      return { terms, subject: video_subject, amount };
    } catch (error) {
      throw new Error(`Failed to generate terms: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async createVideo(params: any, context: any): Promise<any> {
    try {
      const {
        video_subject,
        video_script = '',
        video_aspect = '9:16',
        voice_name = '',
        bgm_type = 'random',
        subtitle_enabled = true
      } = params;
      
      // Generate task ID for tracking
      const taskId = `video_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      return {
        task_id: taskId,
        status: 'initiated',
        estimated_completion: '5-10 minutes',
        subject: video_subject,
        aspect: video_aspect,
        settings: {
          voice_name,
          bgm_type,
          subtitle_enabled
        }
      };
    } catch (error) {
      throw new Error(`Failed to create video: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async synthesizeVoice(params: any, context: any): Promise<any> {
    try {
      const { text, voice_name, voice_rate = 1.0, voice_volume = 1.0 } = params;
      
      // Mock implementation
      const wordCount = text.split(' ').length;
      const duration = wordCount * 0.5 * (1.0 / voice_rate);
      const audioFile = `voice_${Date.now()}.wav`;
      
      return {
        audio_file: audioFile,
        duration,
        format: 'wav',
        voice_used: voice_name,
        settings: { rate: voice_rate, volume: voice_volume }
      };
    } catch (error) {
      throw new Error(`Failed to synthesize voice: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

/**
 * Unified MCP Server
 */
export class UnifiedMCPServer {
  private registry: MCPToolRegistry;
  private authManager: MCPAuthManager;
  private supabaseProvider: SupabaseToolsProvider;
  private moneyPrinterProvider: MoneyPrinterToolsProvider;

  constructor() {
    this.registry = new MCPToolRegistry();
    this.authManager = new MCPAuthManager();
    this.supabaseProvider = new SupabaseToolsProvider();
    this.moneyPrinterProvider = new MoneyPrinterToolsProvider();
    
    this.initializeTools();
  }

  private initializeTools(): void {
    this.supabaseProvider.registerTools(this.registry);
    this.moneyPrinterProvider.registerTools(this.registry);
  }

  async handleRequest(req: VercelRequest, res: VercelResponse): Promise<void> {
    // Set CORS headers
    this.setCorsHeaders(res);
    
    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }

    try {
      if (req.method !== 'POST') {
        res.status(405).json(this.createErrorResponse('method_not_allowed', MCP_ERRORS.INVALID_REQUEST, 'Method not allowed'));
        return;
      }

      // Authenticate request
      const auth = this.authManager.extractAuthFromRequest(req);
      if (!auth) {
        res.status(401).json(this.createErrorResponse('auth_required', MCP_ERRORS.AUTHENTICATION_ERROR, 'Authentication required'));
        return;
      }

      const isValid = auth.type === 'jwt' 
        ? this.authManager.validateJWT(auth.credential)
        : this.authManager.validateApiKey(auth.credential);

      if (!isValid) {
        res.status(401).json(this.createErrorResponse('auth_invalid', MCP_ERRORS.AUTHENTICATION_ERROR, 'Invalid credentials'));
        return;
      }

      // Parse request
      const mcpRequest: MCPRequest = req.body;
      if (!mcpRequest || mcpRequest.jsonrpc !== '2.0') {
        res.status(400).json(this.createErrorResponse('invalid_request', MCP_ERRORS.INVALID_REQUEST, 'Invalid JSON-RPC request'));
        return;
      }

      // Process request
      const response = await this.processRequest(mcpRequest, { auth, req });
      res.status(200).json(response);

    } catch (error) {
      console.error('Server error:', error);
      res.status(500).json(this.createErrorResponse(
        'internal_error', 
        MCP_ERRORS.INTERNAL_ERROR, 
        'Internal server error'
      ));
    }
  }

  private async processRequest(request: MCPRequest, context: any): Promise<MCPResponse> {
    try {
      let result: any;

      switch (request.method) {
        case 'initialize':
          result = this.handleInitialize();
          break;
        case 'tools/list':
          result = this.handleListTools();
          break;
        case 'tools/call':
          result = await this.handleCallTool(request.params, context);
          break;
        case 'server/capabilities':
          result = this.handleGetCapabilities();
          break;
        default:
          return this.createErrorResponse(
            request.id,
            MCP_ERRORS.METHOD_NOT_FOUND,
            `Method not found: ${request.method}`
          );
      }

      return {
        jsonrpc: '2.0',
        id: request.id,
        result
      };
    } catch (error) {
      return this.createErrorResponse(
        request.id,
        MCP_ERRORS.INTERNAL_ERROR,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  private handleInitialize(): any {
    return {
      protocolVersion: '2024-11-05',
      capabilities: {
        tools: {},
        resources: {},
        prompts: {}
      },
      serverInfo: {
        name: 'unified-mcp-server',
        version: '1.0.0',
        description: 'Unified MCP server with Supabase and MoneyPrinterTurbo capabilities'
      }
    };
  }

  private handleListTools(): any {
    return {
      tools: this.registry.getAllTools()
    };
  }

  private async handleCallTool(params: any, context: any): Promise<any> {
    const { name, arguments: args } = params;
    
    if (!name) {
      throw new Error('Tool name is required');
    }

    const tool = this.registry.getTool(name);
    if (!tool) {
      throw new Error(`Tool '${name}' not found`);
    }

    return await this.registry.executeTool(name, args, context);
  }

  private handleGetCapabilities(): any {
    const tools = this.registry.getAllTools();
    const categories = [...new Set(tools.map(t => t.category))];
    
    return {
      capabilities: ['tools', 'resources'],
      tools: {
        total: tools.length,
        categories: categories.map(cat => ({
          name: cat,
          count: this.registry.getToolsByCategory(cat).length
        }))
      },
      version: '1.0.0'
    };
  }

  private createErrorResponse(id: any, code: number, message: string, data?: any): MCPResponse {
    return {
      jsonrpc: '2.0',
      id,
      error: { code, message, data }
    };
  }

  private setCorsHeaders(res: VercelResponse): void {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Max-Age', '86400');
  }
}