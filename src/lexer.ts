import { functionDescriptions } from "./documentation";

let tokenTypes: TokenType[] = [];

class TokenType {
    
    static readonly KEYWORD = new TokenType("keyword", /^(else|fun|if|loop|return|until|var)\b/);
    static readonly MINUS = new TokenType("minus", /^-/);
    static readonly ADDITIVE = new TokenType("additive", /^[\+\-]/);
    static readonly COMPARISON = new TokenType("comparison", /^(==|!=|<=?|>=?)/);
    static readonly MULTIPLICATIVE = new TokenType("multiplicative", /^[\*\/\%]/);
    static readonly BITWiSE_COMPARISON = new TokenType("bitwise comparison", /^[\&\|]/)
    static readonly XOR = new TokenType("xor", /^\^/);
    static readonly BITWISE_SHIFT = new TokenType("bitwise shift", /^(<<|>>)/);
    static readonly NEWLINE = new TokenType("newline", /^\n+/);
    static readonly WHITESPACE = new TokenType("whitespace", /^[ \t]+/);
    static readonly STRING = new TokenType("string", /^"([^"]|\\")*"/);
    static readonly INTEGER = new TokenType("integer", /^\d+/);
    static readonly LEFT_BRACE = new TokenType("left brace", /^\{/);
    static readonly RIGHT_BRACE = new TokenType("left brace", /^\}/);
    static readonly LEFT_PARENTHESES = new TokenType("left parentheses", /^\(/);
    static readonly RIGHT_PARENTHESES = new TokenType("right parentheses", /^\)/);
    static readonly COLON = new TokenType("colon", /^:/);
    static readonly COMMA = new TokenType("comma", /^,/);
    static readonly COMMENT = new TokenType("comment", /^#[^\n]*/);
    static readonly CHARACTER = new TokenType("character", /^'([^']|\\')'/)
    static readonly DOT = new TokenType("dot", /^\./);

    static readonly IDENTIFIER = new TokenType("identifier", /^[a-zA-Z_]\w*/);

    static readonly UNRECOGNIZED = new TokenType("unrecognized", /^[^\n\t ]+/);

    constructor(public readonly name: string, public readonly regex: RegExp, public readonly group = 0) {
        tokenTypes.push(this);
    }

    toString() {
        return this.name;
    }
}

export interface Token { type: TokenType, value: string, line: number, column: number };

export default function tokenize(code: string): Token[] {
    let tokens: Token[] = [];
    let remainingCode = code;
    let currentIndex = 0;
    let lineNumber = 0;
    while (remainingCode) {
        let matchFound = false;
        for (let i = 0; i < tokenTypes.length; i++) {
            let tokenType = tokenTypes[i];
            let match = tokenType.regex.exec(remainingCode);
            if (match) {
                let matchedBit = match[tokenType.group];
                if (tokenType.name !== "whitespace" && tokenType.name !== "comment") tokens.push({ type: tokenType, value: matchedBit, line: lineNumber, column: currentIndex });
                remainingCode = remainingCode.substring(matchedBit.length);
                currentIndex += matchedBit.length;
                if (tokenType.name === "newline") {
                    currentIndex = 0;
                    lineNumber++;
                }
                matchFound = true;
                break;
            }
        }
        if (!matchFound) throw `Error: No match found for ${remainingCode}`;
    }
    return tokens;
}