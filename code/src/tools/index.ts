import { Tool } from './Tool';
import { ReadFileTool } from './read_file';
import { WriteFileTool } from './write_file';
import { EditFileTool } from './edit_file';
import { ListDirTool } from './list_dir';
import { RunCommandTool } from './run_command';
import { ReplaceFileContentTool } from './replace_file_content';
import { MultiReplaceFileContentTool } from './multi_replace_file_content';
import { GrepSearchTool } from './grep_search';
import { GetDiagnosticsTool } from './get_diagnostics';
import { SymbolSearchTool } from './symbol_search';
import { FetchUrlTool } from './fetch_url';
import { DeleteItemTool } from './delete_item';
import { WebSearchTool } from './web_search';
import { UtilityToolsTool } from './utility_tools';

export * from './Tool';
export * from './McpProcessBridge';
export * from './read_file';
export * from './write_file';
export * from './edit_file';
export * from './list_dir';
export * from './run_command';
export * from './replace_file_content';
export * from './multi_replace_file_content';
export * from './grep_search';
export * from './get_diagnostics';
export * from './symbol_search';
export * from './fetch_url';
export * from './delete_item';
export * from './web_search';
export * from './utility_tools';

/**
 * Returns an array of available tools filtered by active mode.
 * @param mode The active mode ('agent' | 'planning' | 'ask').
 * @returns Array of Tool instances.
 */
export function getRegisteredTools(mode: 'agent' | 'planning' | 'ask' | string = 'agent'): Tool[] {
    const utilityTool = new UtilityToolsTool();
    const fetchUrlTool = new FetchUrlTool();
    const webSearchTool = new WebSearchTool();

    // In Ask mode, supply read-only inspection tools + web & utility tools
    if (mode === 'ask') {
        return [
            new ReadFileTool(),
            new ListDirTool(),
            new GrepSearchTool(),
            new GetDiagnosticsTool(),
            new SymbolSearchTool(),
            utilityTool,
            fetchUrlTool,
            webSearchTool
        ];
    }

    // In Agent & Planning mode, supply the full suite of developer tools
    return [
        new ReadFileTool(),
        new WriteFileTool(),
        new EditFileTool(),
        new ListDirTool(),
        new RunCommandTool(),
        new ReplaceFileContentTool(),
        new MultiReplaceFileContentTool(),
        new GrepSearchTool(),
        new GetDiagnosticsTool(),
        new SymbolSearchTool(),
        new FetchUrlTool(),
        new DeleteItemTool(),
        new WebSearchTool(),
        utilityTool
    ];
}
