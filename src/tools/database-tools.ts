import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { 
	Props,
	createErrorResponse,
	createSuccessResponse
} from "../types";
import { validateSqlQuery, isWriteOperation, formatDatabaseError } from "../database/security";
import { withDatabase } from "../database/utils";

// Get authorized user from environment variable for better security
function getAuthorizedUser(env: any): string {
	return env.AUTHORIZED_USER || 'preangelleo'; // fallback to preangelleo if not set
}

// Only authorized user can perform write operations
function isAuthorizedUser(username: string, env: any): boolean {
	return username === getAuthorizedUser(env);
}

export function registerDatabaseTools(server: McpServer, env: Env, props: Props) {
	// Tool 1: List Tables - Available to all authenticated users
	server.tool(
		"listTables",
		"Get a list of all tables in the database along with their column information. Use this first to understand the database structure before querying.",
		{},
		async () => {
			try {
				// Use HTTP API wrapper for database schema retrieval
				const response = await fetch(`${env.DATABASE_URL}/api/tables`, {
					method: 'GET',
					headers: {
						'Content-Type': 'application/json'
					}
				});
				
				if (!response.ok) {
					throw new Error(`HTTP API Error: ${response.status} ${response.statusText}`);
				}
				
				const response_data = await response.json();
				const tableData = response_data.success ? response_data.data : [];
				
				return {
					content: [
						{
							type: "text",
							text: `**MCP Server Status**\n\n✅ **Authentication**: GitHub OAuth working\n✅ **HTTP API**: Connected to ${env.DATABASE_URL}\n✅ **Database**: PostgreSQL via HTTP API wrapper\n✅ **Connection**: Using HTTP API (resolves Cloudflare Workers limitations)\n\n**Table Schema:**\n\`\`\`json\n${JSON.stringify(tableData, null, 2)}\n\`\`\`\n\n**Tables found:** ${Array.isArray(tableData) ? tableData.length : 1}\n**API Response time:** N/A\n**Retrieved at:** ${new Date().toISOString()}`
						}
					]
				};
			} catch (error) {
				console.error('listTables error:', error);
				return createErrorResponse(
					`Error retrieving database schema: ${formatDatabaseError(error)}`
				);
			}
		}
	);

	// Tool 2: Query Database - Available to all authenticated users (read-only)
	server.tool(
		"queryDatabase",
		"Execute a read-only SQL query against the PostgreSQL database. This tool only allows SELECT statements and other read operations. All authenticated users can use this tool.",
		{
			sql: z.string().min(1).describe("SQL query to execute (SELECT statements only)")
		},
		async ({ sql }) => {
			try {
				// Validate the SQL query
				const validation = validateSqlQuery(sql);
				if (!validation.isValid) {
					return createErrorResponse(`Invalid SQL query: ${validation.error}`);
				}
				
				// Check if it's a write operation
				if (isWriteOperation(sql)) {
					return createErrorResponse(
						"Write operations are not allowed with this tool. Use the `executeDatabase` tool if you have write permissions (requires special GitHub username access)."
					);
				}
				
				return await withDatabase((env as any).DATABASE_URL, async (db) => {
					const results = await db.unsafe(sql);
					
					return {
						content: [
							{
								type: "text",
								text: `**Query Results**\n\`\`\`sql\n${sql}\n\`\`\`\n\n**Results:**\n\`\`\`json\n${JSON.stringify(results, null, 2)}\n\`\`\`\n\n**Rows returned:** ${Array.isArray(results) ? results.length : 1}`
							}
						]
					};
				}, props.login);
			} catch (error) {
				console.error('queryDatabase error:', error);
				return createErrorResponse(`Database query error: ${formatDatabaseError(error)}`);
			}
		}
	);

	// Tool 3: Execute Database - Only available to authorized user (write operations)
	if (isAuthorizedUser(props.login, env)) {
		server.tool(
			"executeDatabase",
			"Execute any SQL statement against the PostgreSQL database, including INSERT, UPDATE, DELETE, and DDL operations. This tool is restricted to specific GitHub users and can perform write transactions. **USE WITH CAUTION** - this can modify or delete data.",
			{
				sql: z.string().min(1).describe("SQL command to execute (INSERT, UPDATE, DELETE, CREATE, etc.)")
			},
			async ({ sql }) => {
				try {
					// Validate the SQL query
					const validation = validateSqlQuery(sql);
					if (!validation.isValid) {
						return createErrorResponse(`Invalid SQL statement: ${validation.error}`);
					}
					
					return await withDatabase((env as any).DATABASE_URL, async (db) => {
						const results = await db.unsafe(sql);
						
						const isWrite = isWriteOperation(sql);
						const operationType = isWrite ? "Write Operation" : "Read Operation";
						
						return {
							content: [
								{
									type: "text",
									text: `**${operationType} Executed Successfully**\n\`\`\`sql\n${sql}\n\`\`\`\n\n**Results:**\n\`\`\`json\n${JSON.stringify(results, null, 2)}\n\`\`\`\n\n${isWrite ? '**⚠️ Database was modified**' : `**Rows returned:** ${Array.isArray(results) ? results.length : 1}`}\n\n**Executed by:** ${props.login} (${props.name})`
								}
							]
						};
					}, props.login);
				} catch (error) {
					console.error('executeDatabase error:', error);
					return createErrorResponse(`Database execution error: ${formatDatabaseError(error)}`);
				}
			}
		);
	}
}