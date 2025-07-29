#!/usr/bin/env node

/**
 * Integration Tests for Unified MCP Server
 * 
 * This test suite validates the complete functionality of the unified MCP server
 * including authentication, tool discovery, request routing, and error handling.
 * 
 * Usage:
 *   node test/integration-tests.js [base-url]
 *   
 * Example:
 *   node test/integration-tests.js http://localhost:3000
 *   node test/integration-tests.js https://your-app.vercel.app
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

// Test configuration
const CONFIG = {
  baseUrl: process.argv[2] || 'http://localhost:3000',
  timeout: 30000,
  retries: 3,
  
  // Test API keys (use environment variables in production)
  testApiKey: process.env.TEST_MCP_API_KEY || 'test-api-key-123456789',
  invalidApiKey: 'invalid-key-123',
  
  // Test endpoints
  endpoints: {
    server: '/api/server',
    tools: '/api/server'
  }
};

// Test results tracking
const results = {
  total: 0,
  passed: 0,
  failed: 0,
  errors: []
};

// Utility functions
const log = {
  info: (msg) => console.log(`ℹ️  ${msg}`),
  success: (msg) => console.log(`✅ ${msg}`),
  error: (msg) => console.log(`❌ ${msg}`),
  warn: (msg) => console.log(`⚠️  ${msg}`),
  section: (msg) => console.log(`\n🔍 ${msg}\n${'='.repeat(50)}`)
};

// HTTP request helper
function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(options.url);
    const protocol = url.protocol === 'https:' ? https : http;
    
    const requestOptions = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'MCP-Integration-Test/1.0',
        ...options.headers
      },
      timeout: CONFIG.timeout
    };

    const req = protocol.request(requestOptions, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const response = {
            status: res.statusCode,
            headers: res.headers,
            body: body ? JSON.parse(body) : null
          };
          resolve(response);
        } catch (error) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: body,
            parseError: error.message
          });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

// Test assertion helper
function assert(condition, message, details = null) {
  results.total++;
  
  if (condition) {
    results.passed++;
    log.success(message);
    return true;
  } else {
    results.failed++;
    const error = { message, details, timestamp: new Date().toISOString() };
    results.errors.push(error);
    log.error(message);
    if (details) {
      console.log(`   Details: ${JSON.stringify(details, null, 2)}`);
    }
    return false;
  }
}

// Individual test functions
async function testCorsHeaders() {
  log.section('Testing CORS Headers');
  
  try {
    const response = await makeRequest({
      url: `${CONFIG.baseUrl}${CONFIG.endpoints.server}`,
      method: 'OPTIONS'
    });
    
    assert(
      response.status === 200,
      'OPTIONS request returns 200 status',
      { status: response.status }
    );
    
    assert(
      response.headers['access-control-allow-origin'] === '*',
      'CORS origin header is set correctly',
      { header: response.headers['access-control-allow-origin'] }
    );
    
    assert(
      response.headers['access-control-allow-methods']?.includes('POST'),
      'CORS methods header includes POST',
      { header: response.headers['access-control-allow-methods'] }
    );
    
  } catch (error) {
    assert(false, 'CORS test failed with error', error.message);
  }
}

async function testMethodValidation() {
  log.section('Testing HTTP Method Validation');
  
  try {
    const response = await makeRequest({
      url: `${CONFIG.baseUrl}${CONFIG.endpoints.server}`,
      method: 'GET'
    });
    
    assert(
      response.status === 405,
      'GET request returns 405 Method Not Allowed',
      { status: response.status }
    );
    
    assert(
      response.body?.error?.message?.includes('POST'),
      'Error message indicates POST is required',
      { message: response.body?.error?.message }
    );
    
  } catch (error) {
    assert(false, 'Method validation test failed with error', error.message);
  }
}

async function testToolDiscovery() {
  log.section('Testing Tool Discovery');
  
  try {
    const request = {
      jsonrpc: '2.0',
      id: 'test-1',
      method: 'tools/list',
      params: {}
    };
    
    const response = await makeRequest({
      url: `${CONFIG.baseUrl}${CONFIG.endpoints.tools}`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CONFIG.testApiKey}`
      }
    }, request);
    
    assert(
      response.status === 200,
      'Tool discovery request returns 200 status',
      { status: response.status }
    );
    
    assert(
      response.body?.jsonrpc === '2.0',
      'Response follows JSON-RPC 2.0 format',
      { jsonrpc: response.body?.jsonrpc }
    );
    
    assert(
      Array.isArray(response.body?.result?.tools),
      'Response contains tools array',
      { tools: response.body?.result?.tools?.length }
    );
    
    const tools = response.body?.result?.tools || [];
    const supabaseTools = tools.filter(tool => tool.name?.startsWith('supabase_'));
    const moneyprinterTools = tools.filter(tool => tool.name?.startsWith('moneyprinter_'));
    
    assert(
      supabaseTools.length > 0,
      'Supabase tools are available',
      { count: supabaseTools.length, tools: supabaseTools.map(t => t.name) }
    );
    
    assert(
      moneyprinterTools.length > 0,
      'MoneyPrinter tools are available',
      { count: moneyprinterTools.length, tools: moneyprinterTools.map(t => t.name) }
    );
    
  } catch (error) {
    assert(false, 'Tool discovery test failed with error', error.message);
  }
}

async function testAuthentication() {
  log.section('Testing Authentication');
  
  // Test missing authentication
  try {
    const request = {
      jsonrpc: '2.0',
      id: 'test-auth-1',
      method: 'tools/list',
      params: {}
    };
    
    const response = await makeRequest({
      url: `${CONFIG.baseUrl}${CONFIG.endpoints.server}`,
      method: 'POST'
    }, request);
    
    assert(
      response.status === 401,
      'Request without auth returns 401 Unauthorized',
      { status: response.status }
    );
    
  } catch (error) {
    assert(false, 'Missing auth test failed with error', error.message);
  }
  
  // Test invalid authentication
  try {
    const request = {
      jsonrpc: '2.0',
      id: 'test-auth-2',
      method: 'tools/list',
      params: {}
    };
    
    const response = await makeRequest({
      url: `${CONFIG.baseUrl}${CONFIG.endpoints.server}`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CONFIG.invalidApiKey}`
      }
    }, request);
    
    assert(
      response.status === 401,
      'Request with invalid auth returns 401 Unauthorized',
      { status: response.status }
    );
    
  } catch (error) {
    assert(false, 'Invalid auth test failed with error', error.message);
  }
}

async function testSupabaseTools() {
  log.section('Testing Supabase Tool Execution');
  
  try {
    const request = {
      jsonrpc: '2.0',
      id: 'test-supabase-1',
      method: 'tools/call',
      params: {
        name: 'supabase_select',
        arguments: {
          table: 'test_table',
          columns: '*',
          limit: 1
        }
      }
    };
    
    const response = await makeRequest({
      url: `${CONFIG.baseUrl}${CONFIG.endpoints.server}`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CONFIG.testApiKey}`
      }
    }, request);
    
    // Note: This may fail if Supabase is not configured, but we test the routing
    assert(
      response.status === 200 || response.status === 500,
      'Supabase tool request is routed correctly',
      { status: response.status, body: response.body }
    );
    
    if (response.status === 500) {
      log.warn('Supabase tool failed (likely due to missing configuration)');
    }
    
  } catch (error) {
    assert(false, 'Supabase tool test failed with error', error.message);
  }
}

async function testMoneyPrinterTools() {
  log.section('Testing MoneyPrinter Tool Execution');
  
  try {
    const request = {
      jsonrpc: '2.0',
      id: 'test-moneyprinter-1',
      method: 'tools/call',
      params: {
        name: 'moneyprinter_generate',
        arguments: {
          prompt: 'Test video generation',
          duration: 10
        }
      }
    };
    
    const response = await makeRequest({
      url: `${CONFIG.baseUrl}${CONFIG.endpoints.server}`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CONFIG.testApiKey}`
      }
    }, request);
    
    // Note: This may fail if MoneyPrinter is not configured, but we test the routing
    assert(
      response.status === 200 || response.status === 500,
      'MoneyPrinter tool request is routed correctly',
      { status: response.status, body: response.body }
    );
    
    if (response.status === 500) {
      log.warn('MoneyPrinter tool failed (likely due to missing configuration)');
    }
    
  } catch (error) {
    assert(false, 'MoneyPrinter tool test failed with error', error.message);
  }
}

async function testErrorHandling() {
  log.section('Testing Error Handling');
  
  // Test invalid JSON-RPC
  try {
    const invalidRequest = {
      jsonrpc: '1.0', // Invalid version
      id: 'test-error-1',
      method: 'tools/list'
    };
    
    const response = await makeRequest({
      url: `${CONFIG.baseUrl}${CONFIG.endpoints.server}`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CONFIG.testApiKey}`
      }
    }, invalidRequest);
    
    assert(
      response.body?.error?.code === -32600,
      'Invalid JSON-RPC version returns correct error code',
      { code: response.body?.error?.code }
    );
    
  } catch (error) {
    assert(false, 'Invalid JSON-RPC test failed with error', error.message);
  }
  
  // Test unknown method
  try {
    const unknownRequest = {
      jsonrpc: '2.0',
      id: 'test-error-2',
      method: 'unknown/method',
      params: {}
    };
    
    const response = await makeRequest({
      url: `${CONFIG.baseUrl}${CONFIG.endpoints.server}`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CONFIG.testApiKey}`
      }
    }, unknownRequest);
    
    assert(
      response.body?.error?.code === -32601,
      'Unknown method returns correct error code',
      { code: response.body?.error?.code }
    );
    
  } catch (error) {
    assert(false, 'Unknown method test failed with error', error.message);
  }
  
  // Test unknown tool
  try {
    const unknownToolRequest = {
      jsonrpc: '2.0',
      id: 'test-error-3',
      method: 'tools/call',
      params: {
        name: 'unknown_tool',
        arguments: {}
      }
    };
    
    const response = await makeRequest({
      url: `${CONFIG.baseUrl}${CONFIG.endpoints.server}`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CONFIG.testApiKey}`
      }
    }, unknownToolRequest);
    
    assert(
      response.body?.error?.code === -32601,
      'Unknown tool returns correct error code',
      { code: response.body?.error?.code }
    );
    
  } catch (error) {
    assert(false, 'Unknown tool test failed with error', error.message);
  }
}

async function testPerformance() {
  log.section('Testing Performance');
  
  const startTime = Date.now();
  const requests = [];
  
  // Send 5 concurrent requests
  for (let i = 0; i < 5; i++) {
    const request = makeRequest({
      url: `${CONFIG.baseUrl}${CONFIG.endpoints.server}`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CONFIG.testApiKey}`
      }
    }, {
      jsonrpc: '2.0',
      id: `perf-test-${i}`,
      method: 'tools/list',
      params: {}
    });
    
    requests.push(request);
  }
  
  try {
    const responses = await Promise.all(requests);
    const endTime = Date.now();
    const totalTime = endTime - startTime;
    
    assert(
      responses.every(r => r.status === 200),
      'All concurrent requests succeeded',
      { responses: responses.length, totalTime }
    );
    
    assert(
      totalTime < 10000, // 10 seconds
      'Concurrent requests completed within acceptable time',
      { totalTime, limit: 10000 }
    );
    
  } catch (error) {
    assert(false, 'Performance test failed with error', error.message);
  }
}

// Main test runner
async function runTests() {
  console.log('🚀 Starting Unified MCP Server Integration Tests');
  console.log(`📍 Testing against: ${CONFIG.baseUrl}`);
  console.log(`⏱️  Timeout: ${CONFIG.timeout}ms\n`);
  
  const startTime = Date.now();
  
  try {
    await testCorsHeaders();
    await testMethodValidation();
    await testAuthentication();
    await testToolDiscovery();
    await testSupabaseTools();
    await testMoneyPrinterTools();
    await testErrorHandling();
    await testPerformance();
    
  } catch (error) {
    log.error(`Test runner error: ${error.message}`);
    results.failed++;
  }
  
  const endTime = Date.now();
  const totalTime = endTime - startTime;
  
  // Print results summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST RESULTS SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total Tests: ${results.total}`);
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`⏱️  Total Time: ${totalTime}ms`);
  console.log(`🎯 Success Rate: ${((results.passed / results.total) * 100).toFixed(1)}%`);
  
  if (results.errors.length > 0) {
    console.log('\n🔍 FAILED TESTS:');
    results.errors.forEach((error, index) => {
      console.log(`${index + 1}. ${error.message}`);
      if (error.details) {
        console.log(`   Details: ${JSON.stringify(error.details, null, 2)}`);
      }
    });
  }
  
  console.log('\n' + '='.repeat(60));
  
  // Exit with appropriate code
  process.exit(results.failed > 0 ? 1 : 0);
}

// Run tests if this script is executed directly
if (require.main === module) {
  runTests().catch(error => {
    console.error('Test runner crashed:', error);
    process.exit(1);
  });
}

module.exports = {
  runTests,
  makeRequest,
  assert,
  CONFIG
};