interface Task {
	id: string;
	name: string;
	children: Task[];
	level: number;
	flags?: Record<string, string>;
}

interface Token {
	type: TokenType;
	value: string;
	row: number;
	col: number;
	flags?: Record<string, string>;
}

enum TokenType {
	DASH,
	CHECKBOX,
	TEXT,
	INDENT,
	NEWLINE,
	EOF
}

class Lexer {
	private input: string;
	private position: number = 0;
	private row: number = 0;
	private col: number = 0;

	constructor(input: string) {
		this.input = input;
	}

	private isAtEnd(): boolean {
		return this.position >= this.input.length;
	}

	private current(): string {
		return this.isAtEnd() ? '\0' : this.input[this.position]!;
	}

	private peek(offset: number = 1): string {
		const peekPosition = this.position + offset;
		return peekPosition >= this.input.length ? '\0' : this.input[peekPosition]!;
	}

	private advance(): void {
		if (this.isAtEnd()) return;

		if (this.current() === '\n') {
			this.row++;
			this.col = 0;
		} else {
			this.col++;
		}
		this.position++;
	}

	private skipWhitespace(): void {
		while (!this.isAtEnd() && this.current() === ' ') {
			this.advance();
		}
	}

	private readText(): string {
		let text = '';
		while (!this.isAtEnd() && this.current() !== '\n') {
			text += this.current();
			this.advance();
		}
		return text.trim();
	}

	parseTextWithFlags(text: string): { text: string; flags: Record<string, string> } {
		// Parse [key:value] flags
		const flagPattern = /\[([^:]+):([^\]]+)\]/g;
		const flags: Record<string, string> = {};
		let match;

		while ((match = flagPattern.exec(text)) !== null) {
			if (match[1] !== undefined && match[2] !== undefined) {
				const key = match[1].trim();
				const value = match[2].trim();
				flags[key] = value;
			}
		}

		const cleanText = text.replace(/\[([^:]+):([^\]]+)\]/g, '').trim();

		return {
			text: cleanText,
			flags: flags
		};
	}

	private countIndent(): number {
		let count = 0;
		while (!this.isAtEnd() && (this.current() === '\t' || this.current() === ' ')) {
			if (this.current() === '\t') count++;
			else count += 0.25;
			this.advance();
		}
		return Math.floor(count);
	}

	getNextToken(): Token {
		while (!this.isAtEnd()) {
			switch (this.current()) {
				case '\n':
					this.advance();
					return { type: TokenType.NEWLINE, value: '\n', row: this.row, col: this.col };
				case '\t':
				case ' ':
					const indent = this.countIndent();
					if (indent > 0) {
						return { type: TokenType.INDENT, value: indent.toString(), row: this.row, col: this.col };
					}
					continue;
				case '-':
					this.advance();
					this.skipWhitespace();
					return { type: TokenType.DASH, value: '-', row: this.row, col: this.col };
				case '[':
					if (this.peek() === ']') {
						this.advance();
						this.advance();
						this.skipWhitespace();
						return { type: TokenType.CHECKBOX, value: '[]', row: this.row, col: this.col };
					} else {
						const text = this.readText();
						if (text) {
							const { text: cleanText, flags } = this.parseTextWithFlags(text);
							return {
								type: TokenType.TEXT,
								value: cleanText,
								row: this.row,
								col: this.col,
								flags: flags
							};
						}
						this.advance();
						break;
					}
				default:
					const text = this.readText();
					if (text) {
						const { text: cleanText, flags } = this.parseTextWithFlags(text);
						return {
							type: TokenType.TEXT,
							value: cleanText,
							row: this.row,
							col: this.col,
							flags: flags
						};
					}
					this.advance();
					break;
			}
		}

		return { type: TokenType.EOF, value: '', row: this.row, col: this.col };
	}
}

class Parser {
	private lexer: Lexer;
	private currentToken: Token;
	private idCounter = 0;

	constructor(lexer: Lexer) {
		this.lexer = lexer;
		this.currentToken = this.lexer.getNextToken();
	}

	private next(): void {
		this.currentToken = this.lexer.getNextToken();
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

	private newTask(name: string, level: number, flags?: Record<string, string>): Task {
		this.idCounter++;
		const task: Task = { id: `ph${this.idCounter}`, name, children: [], level };

		if (flags && Object.keys(flags).length > 0) {
			task.flags = flags;
		}

		return task;
	}

	parse(): Task[] {
		const roots: Task[] = [];
		const stack: Task[] = [];

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
			const task = this.newTask(name, indent, flags);
			this.next();

			while (stack.length > 0) {
				const last = stack[stack.length - 1];
				if (!last || last.level < indent) break;
				stack.pop();
			}

			const parent = stack.length > 0 ? stack[stack.length - 1] : undefined;
			if (parent) parent.children.push(task);
			else roots.push(task);

			stack.push(task);

			if (!this.isToken(TokenType.NEWLINE, TokenType.EOF)) {
				this.skipToNextLine();
			} else if (this.isToken(TokenType.NEWLINE)) {
				this.next();
			}
		}

		return roots;
	}
}

interface InterpretResult {
	taskMap: Map<string, Task>;
	linkMap: Map<string, string[]>;
	parentMap: Map<string, string | null>;
	roots: Task[];
}

class Interpreter {
	interpret(roots: Task[]): InterpretResult {
		const taskMap = new Map<string, Task>();
		const linkMap = new Map<string, string[]>();
		const parentMap = new Map<string, string | null>();
		const rootTasks: Task[] = [];

		const visit = (task: Task, parentId: string | null, rootId: string) => {
			taskMap.set(task.id, task);
			parentMap.set(task.id, parentId);

			if (parentId === null) {
				rootTasks.push(task);
			}

			if (parentId !== null) {
				if (!linkMap.has(parentId)) linkMap.set(parentId, []);
				linkMap.get(parentId)!.push(task.id);
			}

			for (const child of task.children) {
				visit(child, task.id, rootId);
			}
		};

		for (const root of roots) {
			visit(root, null, root.id);
		}

		return { taskMap, linkMap, parentMap, roots: rootTasks };
	}
}
export interface TaskParserResult {
	taskMap: Map<string, Task>;
	linkMap: Map<string, string[]>;
	parentMap: Map<string, string | null>;
	roots: Task[];
}

export interface ParsedTask {
	id: string;
	name: string;
	children: ParsedTask[];
	level: number;
	flags?: Record<string, string>;
}
export function parseTaskList(input: string): TaskParserResult {
	const lexer = new Lexer(input);
	const parser = new Parser(lexer);
	const roots = parser.parse();
	const interpreter = new Interpreter();
	return interpreter.interpret(roots);
}
