import { readFileTool } from './read_file.js';
import { writeFileTool } from './write_file.js';
import { editFileTool } from './edit_file.js';
import { bashTool } from './bash.js';
import { globTool } from './glob.js';
import { grepTool } from './grep.js';
import { lsTool } from './ls.js';
import { webSearchTool } from './web_search.js';

export const tools = {
  read_file: readFileTool,
  write_file: writeFileTool,
  edit_file: editFileTool,
  bash: bashTool,
  glob: globTool,
  grep: grepTool,
  ls: lsTool,
  web_search: webSearchTool,
};
