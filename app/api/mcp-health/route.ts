import { NextRequest, NextResponse } from 'next/server';
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

interface KeyValuePair {
  key: string;
  value: string;
}

export async function POST(req: NextRequest) {
  try {
    const { url, headers: customHeaders } = await req.json() as { url: string; headers?: KeyValuePair[] };

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    let client: Client | undefined = undefined;
    const baseUrl = new URL(url);
    
    // Convert KeyValuePair[] to Headers object
    const headerEntries: Record<string, string> = {};
    if (customHeaders && Array.isArray(customHeaders)) {
      console.log('Received custom headers:', customHeaders);
      customHeaders.forEach(({ key, value }) => {
        if (key && value) {
          headerEntries[key] = value;
        }
      });
    } else {
      console.log('No custom headers received or not an array:', customHeaders);
    }

    try {
      // First try Streamable HTTP transport with custom headers
      client = new Client({
        name: 'streamable-http-client',
        version: '1.0.0'
      });

      console.log('Attempting Streamable HTTP connection to:', url);
      console.log('With headers:', headerEntries);
      console.log('Headers count:', Object.keys(headerEntries).length);

      const transport = new StreamableHTTPClientTransport(baseUrl, {
        requestInit: {
          headers: headerEntries
        }
      });
      
      await client.connect(transport);
      console.log("Connected using Streamable HTTP transport");
    } catch (error) {
      // If that fails, try the SSE transport
      console.error("Streamable HTTP connection failed:", error);
      console.log("Falling back to SSE transport");
      client = new Client({
        name: 'sse-client',
        version: '1.0.0'
      });
      
      const sseTransport = new SSEClientTransport(baseUrl, {
        requestInit: {
          headers: headerEntries
        }
      });
      
      await client.connect(sseTransport);
      console.log("Connected using SSE transport");
    }

    // Get tools from the connected client
    const tools = await client.listTools();
    console.log('Tools response:', tools);

    // Disconnect after getting tools
    await client.close();

    if (tools && tools.tools) {
      return NextResponse.json({
        ready: true,
        tools: tools.tools.map(tool => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema
        }))
      });
    } else {
      return NextResponse.json({ ready: false, error: 'No tools available' }, { status: 503 });
    }
  } catch (error) {
    console.error('MCP health check failed:', error);
    return NextResponse.json({
      ready: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 503 });
  }
}
