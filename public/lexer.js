"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getVariableNames = void 0;
let tokenTypes = [];
class TokenType {
    name;
    regex;
    group;
    static KEYWORD = new TokenType("keyword", /^(else|fun|if|loop|return|until|var)\b/);
    static MINUS = new TokenType("minus", /^-/);
    static EQUALS = new TokenType("equals", /^=/);
    static NEWLINE = new TokenType("newline", /^[\r\n]+/);
    static WHITESPACE = new TokenType("whitespace", /^[ \t]+/);
    static STRING = new TokenType("string", /^"([^"]\\")*"/);
    static INTEGER = new TokenType("integer", /^\d+/);
    static LEFT_BRACE = new TokenType("left brace", /^\{/);
    static RIGHT_BRACE = new TokenType("left brace", /^\}/);
    static LEFT_PARENTHESES = new TokenType("left parentheses", /^\(/);
    static RIGHT_PARENTHESES = new TokenType("right parentheses", /^\)/);
    static COLON = new TokenType("colon", /^:/);
    static COMMA = new TokenType("comma", /^,/);
    static COMMENT = new TokenType("comment", /^#[^\n\r]*/);
    static CHARACTER = new TokenType("character", /^'([^']|\\')'/);
    static DOT = new TokenType("dot", /^\./);
    static IDENTIFIER = new TokenType("identifier", /^[a-zA-Z_]\w*/);
    static UNRECOGNIZED = new TokenType("unrecognized", /^[^\n\r\s\t]+/);
    constructor(name, regex, group = 0) {
        this.name = name;
        this.regex = regex;
        this.group = group;
        tokenTypes.push(this);
    }
    toString() {
        return this.name;
    }
}
;
function tokenize(code) {
    let tokens = [];
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
                if (tokenType.name !== "whitespace" && tokenType.name !== "comment")
                    tokens.push({ type: tokenType, value: matchedBit, line: lineNumber, column: currentIndex });
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
        if (!matchFound)
            throw `Error: No match found for ${remainingCode}`;
    }
    return tokens;
}
exports.default = tokenize;
function getVariableNames(tokens) {
    let variableNames = {};
    for (let i = 0; i < tokens.length; i++) {
        if (tokens[i].type.name === "keyword") {
            if (tokens[i].value === "var")
                variableNames[tokens[i + 1].value] = "var";
            else if (tokens[i].value === "fun")
                variableNames[tokens[i + 1].value] = "fun";
        }
    }
    return variableNames;
}
exports.getVariableNames = getVariableNames;
