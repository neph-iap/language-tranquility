export let tokenTypes = {
    "additive": /^[\+\-]/,
    "bitwise comparison": /^[\&\|]/,
    "bitwise shift": /^(<<|>>)/,
    "bitwise not": /\~/,
    "character": /^'([^']|\\')'/,
    "colon": /^:/,
    "comma": /^,/,
    "comment": /^#[^\n]*/,
    "comparison": /^(==|!=|<=?|>=?)/,
    "dot": /^\./,
    "integer": /^\d+/,
    "keyword": /^(else|fun|if|loop|return|until|var)\b/,
    "left brace": /^\{/,
    "left parentheses": /^\(/,
    "minus": /^\-/,
    "multiplicative": /^[\*\/\%]/,
    "newline": /^\n+/,
    "right brace": /^\}/,
    "right parentheses": /^\)/,
    "string": /^"([^"]|\\")*"/,
    "whitespace": /^[ \t]+/,
    "xor": /^\^/,

    "identifier": /^[a-zA-Z_]\w*/,
    "unrecognized": /^[^\n\t ]+/
}

let tokenTypeNames: (keyof typeof tokenTypes)[] = Object.keys(tokenTypes) as (keyof typeof tokenTypes)[];
let tokenTypeAmount = tokenTypeNames.length;

export interface Token { type: keyof typeof tokenTypes, value: string, line: number, column: number };

export default function tokenize(code: string): Token[] {
    let tokens: Token[] = [];
    let remainingCode = code;
    let currentIndex = 0;
    let lineNumber = 0;
    while (remainingCode) {
        let matchFound = false;
        for (let i = 0; i < tokenTypeAmount; i++) {
            let tokenTypeName: keyof typeof tokenTypes = tokenTypeNames[i];
            let tokenTypeRegex = tokenTypes[tokenTypeName];
            let match = tokenTypeRegex.exec(remainingCode);
            if (match) {
                let matchedBit = match[0];
                if (tokenTypeName !== "whitespace" && tokenTypeName !== "comment") tokens.push({ type: tokenTypeName, value: matchedBit, line: lineNumber, column: currentIndex });
                remainingCode = remainingCode.substring(matchedBit.length);
                currentIndex += matchedBit.length;
                if (tokenTypeName === "newline") {
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
