# MoneyPrinterTurbo MCP Server - Deployment Guide

This guide provides step-by-step instructions for deploying the MoneyPrinterTurbo MCP Server to Vercel and integrating it with your development environment.

## Prerequisites

- Node.js 18+ installed
- Vercel account
- Git repository access
- Environment variables configured

## Quick Deployment

### 1. Deploy to Vercel

#### Option A: Deploy via Vercel CLI
```bash
cd utils/mcp-on-vercel
npm install
vercel login
vercel --prod
```

#### Option B: Deploy via GitHub Integration
1. Push your code to GitHub
2. Import repository in Vercel dashboard
3. Set root directory to `utils/mcp-on-vercel`
4. Deploy

### 2. Configure Environment Variables

In your Vercel dashboard, add these environment variables:

```bash
# Required for production
NODE_ENV=production
VERCEL_ENV=production

# Optional: External integrations
OPENAI_API_KEY=your_openai_key_here
ELEVENLABS_API_KEY=your_elevenlabs_key_here
REDIS_URL=redis://your_redis_url

# Optional: Monitoring
SENTRY_DSN=your_sentry_dsn
```

### 3. Update MCP Configuration

After deployment, update your MCP configuration with the actual Vercel URL:

**In `.roo/mcp.json`:**
```json
{
  "servers": [
    {
      "name": "moneyprinter-turbo",
      "url": "https://your-actual-deployment.vercel.app/api/server",
      "tools": ["generate_video", "get_video_status", "list_projects", "system_health", "echo"]
    }
  ]
}
```

## Testing Your Deployment

### 1. Health Check
```bash
curl -X POST https://your-deployment.vercel.app/api/server \
  -H "Content-Type: application/json" \
  -d '{
    "method": "tools/call",
    "params": {
      "name": "system_health",
      "arguments": {}
    }
  }'
```

### 2. Test Echo Tool
```bash
curl -X POST https://your-deployment.vercel.app/api/server \
  -H "Content-Type: application/json" \
  -d '{
    "method": "tools/call",
    "params": {
      "name": "echo",
      "arguments": {
        "message": "Hello from MCP!",
        "format": "json"
      }
    }
  }'
```

### 3. Test Video Generation
```bash
curl -X POST https://your-deployment.vercel.app/api/server \
  -H "Content-Type: application/json" \
  -d '{
    "method": "tools/call",
    "params": {
      "name": "generate_video",
      "arguments": {
        "topic": "Introduction to AI",
        "duration": 60,
        "style": "educational"
      }
    }
  }'
```

## Integration with MoneyPrinterTurbo

### 1. Local Development Setup

Add to your local environment:

```bash
# .env.local
MCP_SERVER_URL=https://your-deployment.vercel.app/api/server
MCP_ENABLED=true
```

### 2. Client Integration

Use the MCP client tools:

```bash
# Test connection
npm run test

# Run integration tests
npm run test:integration
```

## Advanced Configuration

### Custom Domain Setup

1. In Vercel dashboard, go to your project settings
2. Add your custom domain
3. Update MCP configuration with new URL

### Environment-Specific Deployments

Create multiple environments:

```bash
# Production
vercel --prod

# Preview/Staging
vercel

# Development
vercel dev
```

### Monitoring and Logging

Add monitoring tools in `vercel.json`:

```json
{
  "functions": {
    "api/server.ts": {
      "maxDuration": 60,
      "memory": 1024
    }
  },
  "env": {
    "NODE_ENV": "production",
    "LOG_LEVEL": "info"
  }
}
```

## Troubleshooting

### Common Issues

**1. Deployment Fails**
- Check Node.js version compatibility
- Verify all dependencies in package.json
- Review build logs in Vercel dashboard

**2. MCP Connection Issues**
- Verify URL is correct and accessible
- Check CORS settings
- Validate request format

**3. Tool Execution Errors**
- Check environment variables
- Review function logs
- Verify timeout settings

**4. Performance Issues**
- Optimize function memory allocation
- Review cold start times
- Consider edge deployment regions

### Debug Commands

```bash
# Local debugging
npm run dev
vercel logs

# Production debugging
vercel logs --prod
curl -I https://your-deployment.vercel.app/api/server
```

## Security Considerations

1. **Environment Variables**: Never commit secrets to repository
2. **CORS Configuration**: Restrict to known domains in production
3. **Rate Limiting**: Implement appropriate rate limiting
4. **Authentication**: Add API key validation if needed

## Performance Optimization

1. **Function Configuration**: Optimize memory and timeout settings
2. **Cold Starts**: Consider keeping functions warm
3. **Caching**: Implement Redis caching for frequent requests
4. **Monitoring**: Set up alerts for performance metrics

## Maintenance

### Regular Updates

```bash
# Update dependencies
npm update

# Redeploy
vercel --prod
```

### Monitoring Health

Set up automated health checks:

```bash
# Add to CI/CD pipeline
curl -f https://your-deployment.vercel.app/api/server || exit 1
```

## Support

For issues:
1. Check Vercel function logs
2. Review MCP client connection
3. Verify environment configuration
4. Test with provided curl commands

---

🎯 **Ready to Deploy!** Follow this guide to get your MoneyPrinterTurbo MCP Server running on Vercel in minutes.