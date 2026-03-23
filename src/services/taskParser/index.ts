import { Lexer } from "./lexer.js"
import { Parser } from "./parser.js"
import { TaskIndexer } from "./taskIndex.js"
import type { TaskIndex } from "./taskIndex.js"
import * as t from "./serialization.js"

export type { TaskIndex } from "./taskIndex.js"
export { Lexer } from "./lexer.js"
export { Parser } from "./parser.js"
export { TaskIndexer } from "./taskIndex.js"

export * from "./serialization.js"

export function parseTaskList(input: string): TaskIndex {
    const lexer = new Lexer(input);
    const parser = new Parser(lexer.tokenize());
    const roots = parser.parse();
    const indexer = new TaskIndexer();
    return indexer.index(roots);
}

export function createTaskIndexer(): TaskIndexer {
    return new TaskIndexer();
}


// Default export for the main function
export default parseTaskList;
