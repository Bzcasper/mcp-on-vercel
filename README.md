# Unified MCP Server on Vercel

A production-ready unified MCP (Model Context Protocol) server that integrates both **Supabase** and **MoneyPrinterTurbo** capabilities through a single, scalable serverless endpoint deployed on Vercel.

## 🌟 Features

- **🔗 Unified Integration**: Single endpoint for both Supabase database operations and MoneyPrinterTurbo video generation
- **🔐 Shared Authentication**: Centralized auth system supporting API keys and JWT tokens
- **🚀 Serverless Architecture**: Optimized for Vercel with auto-scaling and multi-region deployment
- **🛡️ Production-Ready**: Comprehensive error handling, logging, and security features
- **📊 Tool Discovery**: Automatic discovery and routing of all available MCP tools
- **⚡ High Performance**: Optimized request routing and caching strategies
- **🧪 Fully Tested**: Comprehensive integration test suite included

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ installed
- Vercel CLI installed (`npm i -g vercel`)
- Supabase account and project (optional)
- MoneyPrinterTurbo API access (optional)
- Git repository

### 1. Setup Environment Variables

1. Copy the environment template:
   ```bash
   cp .env.example .env
   ```

2. Configure your credentials in `.env`:
   ```env
   # Core MCP Authentication
   MCP_MASTER_API_KEY=your-secure-master-key-min-32-chars
   MCP_JWT_SECRET=your-jwt-secret-key-min-32-chars
   
   # Supabase Configuration (Optional)
   SUPABASE_URL=https://your-project-id.supabase.co
   SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   
   # MoneyPrinter Configuration (Optional)
   MONEYPRINTER_API_KEY=your-moneyprinter-api-key
   MONEYPRINTER_BASE_URL=https://api.moneyprinterturbo.com
   ```

### 2. Local Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run development server:
   ```bash
   npm run dev
   ```

3. Test the server:
   ```bash
   # Test tool discovery
   curl -X POST http://localhost:3000/api/server \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer your-master-api-key" \
     -d '{"jsonrpc":"2.0","id":"1","method":"tools/list","params":{}}'
   ```

### 3. Deploy to Vercel

1. Login to Vercel:
   ```bash
   vercel login
   ```

2. Deploy the project:
   ```bash
   vercel --prod
   ```

3. Set environment variables in Vercel dashboard or via CLI:
   ```bash
   vercel env add MCP_MASTER_API_KEY production
   vercel env add MCP_JWT_SECRET production
   # Add other variables as needed
   ```

For detailed deployment instructions, see [DEPLOY.md](./DEPLOY.md).

## 🏗️ Architecture Overview

### Unified MCP Integration

```
┌─────────────────────────────────────────────┐
│               Client Request                │
│    (JSON-RPC 2.0 over HTTP/HTTPS)         │
└─────────────────┬───────────────────────────┘
                  │
┌─────────────────▼───────────────────────────┐
│          Vercel Edge Function               │
│         /api/server.ts                      │
│  ┌─────────────────────────────────────┐   │
│  │      Unified MCP Server             │   │
│  │   lib/unified-mcp-server.ts         │   │
│  │                                     │   │
│  │  ┌──────────────┬──────────────┐   │   │
│  │  │   Supabase   │ MoneyPrinter │   │   │
│  │  │   Adapter    │   Adapter    │   │   │
│  │  └──────────────┴──────────────┘   │   │
│  └─────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────┐
│           External Services                 │
│  ┌────────────────┐  ┌─────────────────┐   │
│  │    Supabase    │  │ MoneyPrinterTurbo│   │
│  │   Database     │  │      API        │   │
│  └────────────────┘  └─────────────────┘   │
└─────────────────────────────────────────────┘
```

### Key Components

- **Unified Server**: Single entry point handling all MCP requests
- **Service Adapters**: Specialized handlers for each integrated service
- **Shared Authentication**: Centralized auth supporting multiple methods
- **Request Router**: Intelligent routing based on tool names and capabilities
- **Error Handler**: Comprehensive error handling and logging
- **Type Safety**: Full TypeScript support with strict typing

## 📋 API Documentation

### Base URL
```
Production:  https://your-app.vercel.app/api/server
Development: http://localhost:3000/api/server
```

### Authentication

The server supports multiple authentication methods:

#### 1. Bearer Token (Recommended)
```bash
Authorization: Bearer your-master-api-key
```

#### 2. API Key Header
```bash
X-API-Key: your-master-api-key
```

### JSON-RPC 2.0 Protocol

All requests follow the JSON-RPC 2.0 specification:

```json
{
  "jsonrpc": "2.0",
  "id": "unique-request-id",
  "method": "method_name",
  "params": {}
}
```

### Available Methods

#### Initialize Connection
```bash
curl -X POST https://your-app.vercel.app/api/server \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -d '{
    "jsonrpc": "2.0",
    "id": "1",
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {},
      "clientInfo": {
        "name": "unified-mcp-client",
        "version": "1.0.0"
      }
    }
  }'
```

#### List Available Tools
```bash
curl -X POST https://your-app.vercel.app/api/server \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -d '{
    "jsonrpc": "2.0",
    "id": "2",
    "method": "tools/list",
    "params": {}
  }'
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": "2",
  "result": {
    "tools": [
      {
        "name": "supabase_select",
        "description": "Select data from Supabase table",
        "inputSchema": {
          "type": "object",
          "properties": {
            "table": {"type": "string"},
            "columns": {"type": "string"},
            "where": {"type": "object"},
            "limit": {"type": "number"}
          },
          "required": ["table"]
        }
      },
      {
        "name": "moneyprinter_generate",
        "description": "Generate video content with MoneyPrinterTurbo",
        "inputSchema": {
          "type": "object",
          "properties": {
            "prompt": {"type": "string"},
            "duration": {"type": "number"},
            "style": {"type": "string"}
          },
          "required": ["prompt"]
        }
      }
    ]
  }
}
```

#### Execute Tool
```bash
curl -X POST https://your-app.vercel.app/api/server \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -d '{
    "jsonrpc": "2.0",
    "id": "3",
    "method": "tools/call",
    "params": {
      "name": "supabase_select",
      "arguments": {
        "table": "users",
        "columns": "*",
        "limit": 10
      }
    }
  }'
```

## 🛠️ Available Tools

### Supabase Tools

| Tool Name | Description | Required Params |
|-----------|-------------|-----------------|
| `supabase_select` | Query data from tables | `table` |
| `supabase_insert` | Insert new records | `table`, `data` |
| `supabase_update` | Update existing records | `table`, `data`, `where` |
| `supabase_delete` | Delete records | `table`, `where` |
| `supabase_rpc` | Call stored procedures | `function`, `params` |

### MoneyPrinterTurbo Tools

| Tool Name | Description | Required Params |
|-----------|-------------|-----------------|
| `moneyprinter_generate` | Generate video content | `prompt` |
| `moneyprinter_status` | Check generation status | `job_id` |
| `moneyprinter_download` | Get generated video | `job_id` |

## 🔧 Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| **Core Authentication** |
| `MCP_MASTER_API_KEY` | ✅ | - | Master API key for server access |
| `MCP_JWT_SECRET` | ✅ | - | JWT signing secret |
| **Supabase** |
| `SUPABASE_URL` | ❌ | - | Supabase project URL |
| `SUPABASE_ANON_KEY` | ❌ | - | Public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | ❌ | - | Service role key |
| **MoneyPrinterTurbo** |
| `MONEYPRINTER_API_KEY` | ❌ | - | MoneyPrinter API key |
| `MONEYPRINTER_BASE_URL` | ❌ | - | MoneyPrinter base URL |
| `MONEYPRINTER_MODEL` | ❌ | `gpt-4-turbo` | AI model to use |
| **System** |
| `NODE_ENV` | ❌ | `development` | Environment mode |
| `LOG_LEVEL` | ❌ | `info` | Logging level |

### Project Structure

```
unified-mcp-server/
├── api/
│   └── server.ts              # Vercel API endpoint
├── lib/
│   ├── unified-mcp-server.ts  # Core unified server
│   ├── auth/
│   │   └── handler.ts         # Authentication logic
│   ├── adapters/
│   │   ├── supabase.ts        # Supabase adapter
│   │   └── moneyprinter.ts    # MoneyPrinter adapter
│   └── utils/
│       ├── logger.ts          # Logging utilities
│       └── validation.ts      # Input validation
├── test/
│   └── integration-tests.js   # Integration test suite
├── .env.example               # Environment template
├── DEPLOY.md                  # Deployment guide
├── package.json               # Dependencies
├── tsconfig.json              # TypeScript config
├── vercel.json               # Vercel config
└── README.md                 # This file
```

### Vercel Configuration

Optimized `vercel.json` settings:
- **Runtime**: Node.js 18.x
- **Memory**: 1024MB
- **Timeout**: 30 seconds
- **Regions**: Multi-region deployment
- **CORS**: Configured for cross-origin requests

## 🔧 Development Workflow

### Local Development Setup

1. **Clone and setup:**
   ```bash
   git clone <your-repo-url>
   cd app/mcp/mcp-on-vercel
   npm install
   ```

2. **Environment configuration:**
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

3. **Start development server:**
   ```bash
   npm run dev
   # Server runs on http://localhost:3000
   ```

4. **Run tests:**
   ```bash
   npm test
   # Or run integration tests
   node test/integration-tests.js http://localhost:3000
   ```

### Adding New Service Adapters

To integrate additional MCP services:

1. **Create adapter file:**
   ```bash
   touch lib/adapters/your-service.ts
   ```

2. **Implement adapter interface:**
   ```typescript
   // lib/adapters/your-service.ts
   import { MCPAdapter } from '../types';
   
   export class YourServiceAdapter implements MCPAdapter {
     async listTools() {
       return [
         {
           name: "your_service_tool",
           description: "Your tool description",
           inputSchema: { /* schema */ }
         }
       ];
     }
   
     async callTool(name: string, args: any) {
       switch (name) {
         case "your_service_tool":
           return await this.executeYourTool(args);
         default:
           throw new Error(`Unknown tool: ${name}`);
       }
     }
   }
   ```

3. **Register in unified server:**
   ```typescript
   // lib/unified-mcp-server.ts
   import { YourServiceAdapter } from './adapters/your-service';
   
   // Add to constructor
   if (config.YOUR_SERVICE_ENABLED) {
     this.adapters.set('your-service', new YourServiceAdapter(config));
   }
   ```

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Type check and build |
| `npm run typecheck` | Run TypeScript checks |
| `npm test` | Run test suite |
| `npm run lint` | Lint codebase |
| `npm run deploy` | Deploy to Vercel |

## 💡 Usage Examples

### Basic Tool Discovery
```javascript
const response = await fetch('https://your-app.vercel.app/api/server', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer your-api-key'
  },
  body: JSON.stringify({
    jsonrpc: '2.0',
    id: '1',
    method: 'tools/list',
    params: {}
  })
});

const { result } = await response.json();
console.log('Available tools:', result.tools);
```

### Database Operations
```javascript
// Select data from Supabase
const selectResponse = await fetch('https://your-app.vercel.app/api/server', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer your-api-key'
  },
  body: JSON.stringify({
    jsonrpc: '2.0',
    id: '2',
    method: 'tools/call',
    params: {
      name: 'supabase_select',
      arguments: {
        table: 'users',
        columns: 'id, name, email',
        where: { active: true },
        limit: 10
      }
    }
  })
});

const { result } = await selectResponse.json();
console.log('Users:', result.content[0].text);
```

### Video Generation
```javascript
// Generate video with MoneyPrinterTurbo
const videoResponse = await fetch('https://your-app.vercel.app/api/server', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer your-api-key'
  },
  body: JSON.stringify({
    jsonrpc: '2.0',
    id: '3',
    method: 'tools/call',
    params: {
      name: 'moneyprinter_generate',
      arguments: {
        prompt: 'A stunning sunset over mountains',
        duration: 30,
        style: 'cinematic'
      }
    }
  })
});

const { result } = await videoResponse.json();
console.log('Generation job:', result.content[0].text);
```

### Error Handling
```javascript
try {
  const response = await fetch('https://your-app.vercel.app/api/server', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer your-api-key'
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: '4',
      method: 'tools/call',
      params: {
        name: 'supabase_select',
        arguments: { table: 'nonexistent' }
      }
    })
  });

  const data = await response.json();
  
  if (data.error) {
    console.error('MCP Error:', data.error.message);
  } else {
    console.log('Success:', data.result);
  }
} catch (error) {
  console.error('Network error:', error);
}
```

## 🐛 Troubleshooting

### Common Issues

#### 1. Authentication Errors
```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32001,
    "message": "Authentication required"
  }
}
```

**Solutions:**
- ✅ Verify `MCP_MASTER_API_KEY` is set and matches request
- ✅ Check Authorization header format: `Bearer your-key`
- ✅ Ensure API key is at least 16 characters

#### 2. Tool Not Found
```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32601,
    "message": "Tool not found: unknown_tool"
  }
}
```

**Solutions:**
- ✅ Run `tools/list` to see available tools
- ✅ Check tool name spelling and case
- ✅ Verify service adapter is properly configured

#### 3. Service Configuration Errors
```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32603,
    "message": "Service unavailable: supabase"
  }
}
```

**Solutions:**
- ✅ Verify environment variables for the service
- ✅ Check service credentials and permissions
- ✅ Test service connectivity independently

#### 4. Function Timeout
**Symptoms:** Requests hang or timeout after 30 seconds

**Solutions:**
- ✅ Optimize database queries with proper indexes
- ✅ Implement request pagination for large datasets
- ✅ Add timeouts to external API calls
- ✅ Consider upgrading Vercel plan for longer timeouts

#### 5. Memory Limitations
**Symptoms:** Functions crash with out-of-memory errors

**Solutions:**
- ✅ Process data in smaller chunks
- ✅ Use streaming for large responses
- ✅ Implement result pagination
- ✅ Optimize data structures and algorithms

### Debugging Tools

1. **Vercel Logs:**
   ```bash
   vercel logs --follow
   ```

2. **Local Testing:**
   ```bash
   npm run dev
   curl -X POST http://localhost:3000/api/server \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer test-key" \
     -d '{"jsonrpc":"2.0","id":"test","method":"tools/list","params":{}}'
   ```

3. **Integration Tests:**
   ```bash
   node test/integration-tests.js https://your-app.vercel.app
   ```

## 📊 Performance & Monitoring

### Built-in Monitoring
- Request/response logging with correlation IDs
- Performance metrics collection
- Error tracking with context
- Service health indicators

### Recommended Monitoring Stack
- **Vercel Analytics**: Function performance and usage
- **Sentry**: Error tracking and performance monitoring
- **Uptime Robot**: Availability monitoring
- **Grafana**: Custom dashboards for metrics

### Performance Optimization
- Response caching for static data
- Connection pooling for databases
- Optimized bundle sizes
- Cold start minimization

## 🔒 Security

### Authentication & Authorization
- Master API key validation
- JWT token support
- Request rate limiting
- IP allowlisting (optional)

### Data Protection
- HTTPS enforcement
- Input sanitization
- SQL injection prevention
- Environment variable encryption

### Best Practices
- Regular security audits
- API key rotation
- Access logging
- Principle of least privilege

## 📚 Resources

### Documentation
- [MCP Specification](https://modelcontextprotocol.io/docs)
- [Vercel Documentation](https://vercel.com/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [MoneyPrinterTurbo API](https://docs.moneyprinterturbo.com)

### Examples & Templates
- [Integration Test Suite](./test/integration-tests.js)
- [Environment Template](./.env.example)
- [Deployment Guide](./DEPLOY.md)

## 🤝 Contributing

### Development Process
1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Make changes with proper tests
4. Run quality checks: `npm test && npm run lint`
5. Submit pull request with clear description

### Code Standards
- TypeScript strict mode
- Comprehensive error handling
- Unit tests for new features
- Documentation updates
- Security considerations

## 📞 Support

### Getting Help
1. **Documentation**: Review this README and [DEPLOY.md](./DEPLOY.md)
2. **Integration Tests**: Run tests to verify functionality
3. **GitHub Issues**: Search existing issues or create new one
4. **Community**: Join discussions and share experiences

### Reporting Issues
Include the following information:
- Environment details (Node.js version, OS)
- Configuration (sanitized environment variables)
- Error messages with request IDs
- Steps to reproduce
- Expected vs actual behavior

---

## 📄 License

MIT License - see [LICENSE](./LICENSE) file for details.

**Ready to deploy your unified MCP server? Check out [DEPLOY.md](./DEPLOY.md) for comprehensive deployment instructions!** 🚀
