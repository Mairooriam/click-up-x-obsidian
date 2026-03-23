export enum TokenType {
    DASH,
    CHECKBOX,
    TEXT,
    INDENT,
    NEWLINE,
    EOF
}

export interface Token {
    type: TokenType;
    value: string;
    row: number;
    col: number;
    flags?: Record<string, string>;
}

export class Lexer {
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

	tokenize(): Token[] {
        const tokens: Token[] = [];
        
        while (!this.isAtEnd()) {
            const token = this.getNextToken();
            tokens.push(token);
            
            if (token.type === TokenType.EOF) {
                break;
            }
        }
        
        return tokens;
    }
}
