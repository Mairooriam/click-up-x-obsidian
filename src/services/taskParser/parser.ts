import type {Token} from "./lexer.js"
import {TokenType} from "./lexer.js"
import type {Task} from "./types.js"

export class Parser {
    private tokens: Token[];
    private currentToken: Token;
    private currentIndex: number = 0;
    private idCounter = 0;

    constructor(tokens: Token[]) {
        this.tokens = tokens;
        this.currentToken = this.tokens[this.currentIndex] || { type: TokenType.EOF, value: "", row: 0, col: 0 };
    }

    private next(): void {
        this.currentIndex++;
        this.currentToken = this.tokens[this.currentIndex] || { type: TokenType.EOF, value: "", row: 0, col: 0 };
    }

    private isToken(...types: TokenType[]): boolean {
        return types.includes(this.currentToken.type);
    }

    private skipToNextLine(): void {
        while (!this.isToken(TokenType.NEWLINE, TokenType.EOF)) {
            this.next();
        }
        if (this.isToken(TokenType.NEWLINE)) this.next();
    }

    private newTask(name: string, flags?: Record<string, string>, parentId: string | null = null, level: number = 0): Task {
        this.idCounter++;
        const task: Task = {
            id: `ph${this.idCounter}`,
            name,
            parent: parentId,
            level,
        };

        if (flags && Object.keys(flags).length > 0) {
            task.flags = flags;
        }

        return task;
    }

    parse(): Task[] {
        const allTasks: Task[] = [];
        const stack: { task: Task; indentLevel: number }[] = [];

        while (!this.isToken(TokenType.EOF)) {
            if (this.isToken(TokenType.NEWLINE)) {
                this.next();
                continue;
            }

            let indent = 0;
            if (this.isToken(TokenType.INDENT)) {
                indent = Number(this.currentToken.value);
                this.next();
            }

            if (!this.isToken(TokenType.DASH, TokenType.CHECKBOX)) {
                this.skipToNextLine();
                continue;
            }
            this.next();

            if (!this.isToken(TokenType.TEXT)) {
                this.skipToNextLine();
                continue;
            }

            const name = this.currentToken.value;
            const flags = this.currentToken.flags;

            // Pop stack items with higher or equal indent level
            while (stack.length > 0) {
                const last = stack[stack.length - 1];
                if (!last || last.indentLevel < indent) break;
                stack.pop();
            }

            const parent = stack.length > 0 ? stack[stack.length - 1]?.task : null;
            const parentId = parent ? parent.id : null;
            const level = parent ? parent.level + 1 : 0;
            const task = this.newTask(name, flags, parentId, level);
            this.next();

            allTasks.push(task);
            stack.push({ task, indentLevel: indent });

            if (!this.isToken(TokenType.NEWLINE, TokenType.EOF)) {
                this.skipToNextLine();
            } else if (this.isToken(TokenType.NEWLINE)) {
                this.next();
            }
        }

        return allTasks;
    }
}