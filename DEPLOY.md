# Unified MCP Server Deployment Guide

This guide walks you through deploying the Unified MCP Server to Vercel, which integrates both Supabase and MoneyPrinterTurbo MCP capabilities in a single, scalable serverless endpoint.

## 📋 Prerequisites

Before deploying, ensure you have:

- [Vercel account](https://vercel.com/signup) (free tier works)
- [Vercel CLI](https://vercel.com/docs/cli) installed (`npm i -g vercel`)
- Node.js 18+ installed
- Access to Supabase project (optional but recommended)
- MoneyPrinterTurbo API credentials (optional but recommended)

## 🚀 Quick Deployment

### Option 1: Deploy via Vercel CLI (Recommended)

```bash
# 1. Clone and navigate to the project
cd app/mcp/mcp-on-vercel

# 2. Install dependencies
npm install

# 3. Login to Vercel
vercel login

# 4. Deploy to Vercel
vercel --prod

# 5. Configure environment variables (see Environment Setup below)
```

### Option 2: Deploy via GitHub Integration

1. Fork/clone this repository to your GitHub account
2. Connect your GitHub repository to Vercel
3. Import the project in Vercel dashboard
4. Set the **Root Directory** to: `app/mcp/mcp-on-vercel`
5. Configure environment variables (see below)
6. Deploy

## ⚙️ Environment Setup

### 1. Copy Environment Template

```bash
cp .env.example .env
```

### 2. Configure Required Variables

#### Core MCP Authentication
```bash
# Master API key for unified server access (generate a secure 32+ char key)
MCP_MASTER_API_KEY=your-secure-master-key-min-32-characters

# JWT signing secret (generate a secure 32+ char secret)
MCP_JWT_SECRET=your-jwt-secret-key-min-32-characters
```

#### Supabase Configuration (Optional)
```bash
# Get these from your Supabase project settings
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
```

#### MoneyPrinterTurbo Configuration (Optional)
```bash
# Get these from your MoneyPrinterTurbo account
MONEYPRINTER_API_KEY=your-moneyprinter-api-key
MONEYPRINTER_BASE_URL=https://api.moneyprinterturbo.com
MONEYPRINTER_MODEL=gpt-4-turbo
```

### 3. Set Environment Variables in Vercel

#### Via Vercel CLI:
```bash
# Set production environment variables
vercel env add MCP_MASTER_API_KEY production
vercel env add MCP_JWT_SECRET production
vercel env add SUPABASE_URL production
vercel env add SUPABASE_ANON_KEY production
# ... continue for all variables
```

#### Via Vercel Dashboard:
1. Go to your project in [Vercel Dashboard](https://vercel.com/dashboard)
2. Navigate to **Settings** → **Environment Variables**
3. Add each variable with appropriate environment scope:
   - **Production**: For live deployment
   - **Preview**: For preview deployments
   - **Development**: For local development

## 🧪 Testing Your Deployment

### 1. Run Integration Tests

```bash
# Test against your deployed endpoint
node test/integration-tests.js https://your-app.vercel.app

# Test locally during development
npm run dev
node test/integration-tests.js http://localhost:3000
```

### 2. Manual Testing

#### Test Tool Discovery
```bash
curl -X POST https://your-app.vercel.app/api/server \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-master-api-key" \
  -d '{
    "jsonrpc": "2.0",
    "id": "test-1",
    "method": "tools/list",
    "params": {}
  }'
```

Expected Response:
```json
{
  "jsonrpc": "2.0",
  "id": "test-1",
  "result": {
    "tools": [
      {
        "name": "supabase_select",
        "description": "Select data from Supabase table",
        "inputSchema": { ... }
      },
      {
        "name": "moneyprinter_generate",
        "description": "Generate video content",
        "inputSchema": { ... }
      }
    ]
  }
}
```

#### Test Supabase Tool
```bash
curl -X POST https://your-app.vercel.app/api/server \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-master-api-key" \
  -d '{
    "jsonrpc": "2.0",
    "id": "test-2",
    "method": "tools/call",
    "params": {
      "name": "supabase_select",
      "arguments": {
        "table": "your_table",
        "limit": 5
      }
    }
  }'
```

## 📡 API Endpoints

### Base URL Structure
```
Production:  https://your-app.vercel.app/api/server
Preview:     https://your-app-git-branch.vercel.app/api/server
Local:       http://localhost:3000/api/server
```

### Available Methods

| Method | Description | Authentication |
|--------|-------------|----------------|
| `initialize` | Initialize MCP connection | Required |
| `tools/list` | List all available tools | Required |
| `tools/call` | Execute a specific tool | Required |

### Authentication Methods

#### 1. Bearer Token (Recommended)
```bash
Authorization: Bearer your-master-api-key
```

#### 2. API Key Header
```bash
X-API-Key: your-master-api-key
```

#### 3. JWT Token
```bash
Authorization: Bearer your-jwt-token
```

## 🔧 Configuration Options

### Vercel Function Settings

The deployment includes optimized Vercel configuration:

```javascript
// vercel.json
{
  "functions": {
    "api/server.ts": {
      "maxDuration": 30
    }
  },
  "regions": ["iad1", "sfo1"]
}
```

### Performance Optimization

#### Memory & Timeout
- **Function Memory**: 1024MB (default)
- **Execution Timeout**: 30 seconds
- **Response Size Limit**: 8MB

#### Caching Strategy
- **Static Assets**: Cached indefinitely
- **API Responses**: No caching (real-time data)
- **Edge Locations**: Multi-region deployment

### Rate Limiting (Optional)

Enable rate limiting with Vercel KV:

```bash
# Add Vercel KV integration
vercel integration add kv

# Enable rate limiting in environment
vercel env add ENABLE_RATE_LIMITING true
vercel env add RATE_LIMIT_RPM 60
```

## 🔍 Monitoring & Observability

### Built-in Logging

The server includes comprehensive logging:

```bash
# View function logs
vercel logs https://your-app.vercel.app

# Stream real-time logs
vercel logs --follow
```

### Error Tracking

#### Production Error Handling
- All errors are logged with context
- Sensitive information is masked
- Request IDs for correlation
- Performance metrics tracking

#### Health Monitoring
```bash
# Check server health
curl -X OPTIONS https://your-app.vercel.app/api/server
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
- Verify `MCP_MASTER_API_KEY` is set correctly
- Check Authorization header format
- Ensure API key is at least 16 characters

#### 2. Environment Variable Issues
```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32603,
    "message": "Internal server error"
  }
}
```

**Solutions:**
- Check all required environment variables are set
- Verify Supabase/MoneyPrinter credentials
- Review Vercel function logs

#### 3. Tool Execution Failures
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
- Verify tool name matches available tools
- Check tool-specific configuration
- Review tool parameters and schema

#### 4. Timeout Issues
```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32603,
    "message": "Function timeout"
  }
}
```

**Solutions:**
- Optimize tool execution logic
- Increase function timeout in `vercel.json`
- Implement request batching for large operations

### Debug Mode

Enable debug logging in development:

```bash
vercel env add LOG_LEVEL debug development
vercel env add DEV_ENABLE_DEBUG_LOGS true development
```

### Performance Issues

#### Slow Response Times
1. Check function region proximity to data sources
2. Optimize database queries
3. Implement response caching where appropriate
4. Monitor function cold starts

#### Memory Limits
1. Monitor function memory usage in Vercel dashboard
2. Optimize data processing algorithms
3. Implement streaming for large responses

## 🔐 Security Best Practices

### API Key Management
- **Rotate keys regularly** (monthly recommended)
- **Use different keys** for development/production
- **Monitor API key usage** in logs
- **Implement key expiration** if possible

### Access Control
- **Restrict CORS origins** in production
- **Implement IP allowlisting** if needed
- **Monitor unusual access patterns**
- **Log all authentication attempts**

### Data Protection
- **Encrypt sensitive data** at rest
- **Use HTTPS only** (enforced by Vercel)
- **Validate all inputs** rigorously
- **Sanitize error messages** in production

## 📊 Scaling Considerations

### Vercel Limits (Free Tier)
- **Function Invocations**: 100,000/month
- **Execution Time**: 100 hours/month
- **Bandwidth**: 100GB/month

### Scaling Strategies
1. **Optimize function performance** to reduce execution time
2. **Implement caching** for frequently accessed data
3. **Use edge functions** for simple operations
4. **Consider Vercel Pro** for higher limits

## 🔄 Continuous Deployment

### GitHub Integration
```yaml
# .github/workflows/deploy.yml
name: Deploy to Vercel
on:
  push:
    branches: [main]
    paths: ['app/mcp/mcp-on-vercel/**']

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.ORG_ID }}
          vercel-project-id: ${{ secrets.PROJECT_ID }}
          working-directory: app/mcp/mcp-on-vercel
```

### Environment Promotion
```bash
# Promote preview to production
vercel --prod

# Create preview deployment
vercel

# Rollback deployment
vercel rollback [deployment-url]
```

## 📞 Support

### Getting Help
- **Documentation**: Check this guide and README.md
- **Integration Tests**: Run tests for debugging
- **Vercel Logs**: Check function execution logs
- **Community**: Vercel Discord/GitHub discussions

### Reporting Issues
When reporting issues, include:
- Deployment URL
- Environment (production/preview/development)
- Error messages and request IDs
- Steps to reproduce
- Expected vs actual behavior

---

## 🎯 Next Steps

After successful deployment:

1. **Set up monitoring** and alerting
2. **Configure rate limiting** if needed
3. **Implement custom tools** for your use case
4. **Set up CI/CD pipeline** for automated deployments
5. **Review security settings** regularly

Your Unified MCP Server is now ready to handle both Supabase and MoneyPrinterTurbo operations through a single, scalable endpoint! 🚀