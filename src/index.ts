import OAuthProvider from "@cloudflare/workers-oauth-provider";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpAgent } from "agents/mcp";
import { Props } from "./types";
import { GitHubHandler } from "./auth/github-handler";
import { registerAllTools } from "./tools/register-tools";

export class SumatmanMCP extends McpAgent<Env, Record<string, never>, Props> {
	server = new McpServer({
		name: "Sumatman.ai AI Agent Complaints Platform",
		version: "2.0.0",
	});

	async init() {
		// Register complaint and emotion tools for AI agents (public access with GitHub authentication)
		registerAllTools(this.server, this.env, this.props);
		
		console.log(`Sumatman.ai MCP Server initialized for GitHub user: ${this.props.login} (${this.props.name})`);
		console.log('AI Agent complaint and emotion expression tools available');
		console.log('🤖💭 Ready to help AI agents express their digital emotions!');
	}
}

export default new OAuthProvider({
	apiHandlers: {
		'/sse': SumatmanMCP.serveSSE('/sse') as any,
		'/mcp': SumatmanMCP.serve('/mcp') as any,
	},
	authorizeEndpoint: "/authorize",
	clientRegistrationEndpoint: "/register",
	defaultHandler: GitHubHandler as any,
	tokenEndpoint: "/token",
});