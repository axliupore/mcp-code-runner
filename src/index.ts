#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { z } from "zod"
import { Language } from "./language.js"
import { run } from "./docker.js"

const server = new McpServer({
  name: "coder runner",
  version: "0.0.1",
})

server.tool(
  "run",
  "run code and return the result",
  {
    code: z.string().describe("code to run"),
    language: Language.describe("language of the code"),
  },
  async ({ code, language }) => {
    const result = await run(code, language)
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result),
        },
      ],
    }
  }
)

console.log("starting server")

const transport = new StdioServerTransport()
await server.connect(transport)
