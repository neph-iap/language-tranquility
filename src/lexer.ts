class TokenType {
    
    static ADD = new TokenType("add", /^+/);

    constructor(public readonly name: string, public readonly regex: RegExp) {}
}