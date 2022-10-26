"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TokenError = void 0;
const vscode = require("vscode");
class TokenError extends Error {
    token;
    severity;
    constructor(token, message, severity = vscode.DiagnosticSeverity.Error) {
        super(message);
        this.token = token;
        this.severity = severity;
    }
}
exports.TokenError = TokenError;
class Parser {
    tokens;
    constructor(tokens) {
        this.tokens = tokens;
    }
    next(expectedType, expectedValue) {
        if (expectedType && this.tokens[0].type.name !== expectedType)
            throw new TokenError(this.tokens[0], `Expected type ${expectedType} but found ${this.tokens[0].type.name}`);
        if (expectedValue && this.tokens[0].value !== expectedValue)
            throw new TokenError(this.tokens[0], `Expected ${expectedValue} but found ${this.tokens[0].value}`);
        return this.tokens.shift();
    }
    nextIs(expectedType, expectedValue) {
        if (!expectedValue)
            return this.tokens[0].type.name === expectedType;
        return this.tokens[0].type.name === expectedType && this.tokens[0].value === expectedValue;
    }
    parse() {
        let node = { type: "program" };
        if (this.nextIs("keyword", "var"))
            node.varList = this.parseVarList();
        if (this.nextIs("keyword", "fun"))
            node.funList = this.parseFunctionList();
        return node;
    }
    parseFunctionList() {
        let node = this.parseFunctionDeclaration();
        if (this.nextIs("keyword", "fun"))
            node.nextFunction = this.parseFunctionDeclaration();
        return node;
    }
    parseFunctionDeclaration() {
        this.next("keyword", "fun");
        let name = this.next("identifier");
        this.next("left parentheses");
        let args = null;
        if (!this.nextIs("right parentheses"))
            args = this.parseIdentifierList();
        this.next("right parentheses");
        this.next("left brace");
        this.next("newline");
        let body = { type: "function body" };
        if (this.nextIs("keyword", "var"))
            body.varList = this.parseVarList();
        if (this.nextIs(""))
            body.statementlist = this.parseStatementList();
        let node = {
            type: "function declaration",
            name: name,
            body: body
        };
        if (args)
            node.arguments = args;
        return node;
    }
    parseIdentifierList() {
        let identifiers = { type: "identifier list" };
        identifiers.value = this.next("identifier");
        if (this.nextIs("comma")) {
            this.next("comma");
            identifiers.nextIdentifier = this.parseIdentifierList();
        }
        return identifiers;
    }
    parseVarList() {
        let node = { type: "var list" };
        this.next("keyword", "var");
        node["identifier list"] = this.parseIdentifierList();
        this.next("newline");
        if (this.nextIs("keyword", "var"))
            node["sub var list"] = this.parseVarList();
        return node;
    }
    parseStatementList() {
        let node = { type: "statement list" };
        if (this.nextIs("newline")) {
            this.next("newline");
            node.nextStatement = this.parseStatementList();
            return node;
        }
        node.statement = this.parseStatement();
        return node;
    }
    parseStatement() {
        if (this.nextIs("keyword", "if"))
            return this.parseIfStatement();
        if (this.nextIs("keyword", "until")) {
            let node = { type: "until statement" };
            this.next("keyword", "until");
            node.expression = this.parseExpression();
            this.next("newline");
        }
        if (this.nextIs("keyword", "loop")) {
            let node = { type: "loop" };
            this.next("keyword", "loop");
            this.next("left brace");
            this.next("newline");
            node.body = this.parseStatementList();
            this.next("right brace");
            this.next("newline");
            return node;
        }
        if (this.nextIs("return")) {
            let node = { type: "return statement" };
            if (this.nextIs("newline")) {
                this.next("newline");
                return node;
            }
            node.value = this.parseExpression();
            this.next("newline");
            return node;
        }
        let expression = this.parseExpression();
        if (this.nextIs("colon")) {
            let node = { type: "assignment" };
            node.expression1 = expression;
            node.expression2 = this.parseExpression();
            this.next("newline");
            return node;
        }
        if (this.nextIs("newline")) {
            let node = { type: "expression statement" };
            node.expression = expression;
            this.next("newline");
            return node;
        }
        throw new TokenError(this.tokens[0], `Unexpected token: ${this.next().value}`);
    }
    parseExpression() {
        if (this.nextIs("integer") || this.nextIs("character") || this.nextIs("string")) {
            return this.parseLiteral();
        }
        if (this.nextIs("identifier")) {
            let identifier = this.next("identifier");
            if (this.nextIs("left parentheses")) {
                this.next("left parentheses");
                let node = { type: "function call" };
                node.name = identifier;
                node.arguments = this.parseExpressionList();
                this.next("right parenthses");
                return node;
            }
            return { type: "identifier", value: identifier.value };
        }
        if (this.nextIs("left parentheses")) {
            this.next("left parentheses");
            let node = { type: "expression" };
            if (!this.nextIs("right parentheses")) {
                node.expressionList = this.parseExpressionList();
            }
            this.next("right parentheses");
            return node;
        }
        if (this.nextIs("dot")) {
            let node = { type: "unary operation expression" };
            node.operation = this.next("dot");
            node.expression = this.parseExpression();
            return node;
        }
        if (this.nextIs("minus")) {
            let node = { type: "negation" };
            this.next("minus");
            node.expression = this.parseExpression();
        }
        if (this.nextIs("bitwise not")) {
            let node = { type: "bitwise negation" };
            this.next("bitwise not");
            node.expression = this.parseExpression();
        }
        throw new TokenError(this.tokens[0], `Unexpected token: ${this.next().value}`);
    }
    parseLiteral() {
        return { type: this.next().type.name, value: this.next().value };
    }
    parseExpressionList() {
        let expression = this.parseExpression();
        if (this.nextIs("comma")) {
            this.next("comma");
            expression.nextExpression = this.parseExpression();
        }
        return expression;
    }
    parseIfStatement() {
        let node = { type: "if statement" };
        this.next("keyword", "if");
        node.condition = this.parseExpression();
        this.next("left brace");
        this.next("newline");
        node.body = this.parseStatementList();
        this.next("right brace");
        this.next("newline");
        if (this.nextIs("keyword", "else")) {
            if (this.nextIs("keyword", "if"))
                node.elseBody = this.parseIfStatement();
            else if (this.nextIs("left brace")) {
                this.next("left brace");
                this.next("newline");
                node.elseBody = this.parseStatementList();
                this.next("right brace");
            }
        }
        return node;
    }
}
exports.default = Parser;
