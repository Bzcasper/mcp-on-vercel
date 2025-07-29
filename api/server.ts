import type { VercelRequest, VercelResponse } from '@vercel/node';
import { UnifiedMCPServer } from '../lib/unified-mcp-server';

/**
 * Unified MCP Server API Endpoint for Vercel
 * 
 * This serverless function provides a unified MCP (Model Context Protocol) interface
 * that integrates both Supabase and MoneyPrinterTurbo MCP servers, with shared
 * authentication, routing, and configuration management.
 * 
 * Features:
 * - Unified tool discovery and execution
 * - Shared authentication (API keys, JWT tokens)
 * - Request routing based on tool prefixes
 * - Comprehensive error handling
 * - CORS support for cross-origin requests
 * - Environment-based configuration
 */

let mcpServer: UnifiedMCPServer | null = null;

/**
 * Get or create singleton MCP server instance
 * This ensures efficient resource usage in serverless environment
 */
function getServerInstance(): UnifiedMCPServer {
  if (!mcpServer) {
    mcpServer = new UnifiedMCPServer();
  }
  return mcpServer;
}

/**
 * Main Vercel serverless function handler
 * Delegates all request processing to the UnifiedMCPServer
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const server = getServerInstance();
    await server.handleRequest(req, res);
  } catch (error) {
    console.error('Unified MCP Server critical error:', error);
    
    // Ensure we always send a response, even if headers were already sent
    if (!res.headersSent) {
      // Set CORS headers for error responses
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      
      res.status(500).json({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal server error',
          data: {
            error: error instanceof Error ? error.message : 'Unknown critical error',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-vercel-id'] || 'unknown'
          }
        }
      });
    }
  }
}

/**
 * Vercel configuration for optimal performance
 */
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '2mb', // Increased for potential batch operations
    },
    responseLimit: '8mb', // Allow for larger responses
  },
  // Enable edge runtime for better performance (optional)
  // runtime: 'edge',
  
  // Specify regions for optimal latency
  regions: ['iad1', 'sfo1'], // US East and West
};
