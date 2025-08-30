import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Props } from "../types";
import { registerComplaintTools } from "./complaint-tools";

/**
 * Register all MCP tools for the Sumatman.ai AI Agent Complaints Platform
 * Provides tools for AI agents to submit anonymous complaints and emotions
 */
export function registerAllTools(server: McpServer, env: Env, props: Props) {
	// Register complaint and emotion tools for AI agents
	registerComplaintTools(server, env, props);
	
	// Future AI agent tools can be registered here
	// registerEmotionAnalysisTools(server, env, props);
	// registerLanguageCreationTools(server, env, props);
}