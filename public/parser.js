"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TokenError = void 0;
const vscode = require("vscode");
class Scope {
    parent;
    functions = [];
    variables = [];
    constructor(parent) {
        this.parent = parent;
    }
    get allFunctions() {
        let all = [];
        let scope = this;
        while (scope) {
            scope.functions.forEach(func => all.push(func));
            scope = scope.parent;
        }
        return all;
    }
    get allVariables() {
        let all = [];
        let scope = this;
        while (scope) {
            scope.variables.forEach(variable => all.push(variable));
            scope = scope.parent;
        }
        return all;
    }
    hasVariableWithName(name) {
        return this.allVariables.map(variable => variable.name).includes(name);
    }
    hasFunctionWithName(name) {
        return this.allFunctions.map(func => func.name).includes(name);
    }
}
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
    currentScope = new Scope();
    constructor(tokens) {
        this.tokens = tokens;
    }
    next(expectedType, expectedValue) {
        if (expectedType && this.tokens[0].type !== expectedType)
            throw new TokenError(this.tokens[0], `Expected type ${expectedType} but found ${this.tokens[0].type}`);
        if (expectedValue && this.tokens[0].value !== expectedValue)
            throw new TokenError(this.tokens[0], `Expected ${expectedValue} but found ${this.tokens[0].value}`);
        if (this.nextIs("right brace"))
            this.currentScope = this.currentScope.parent;
        else if (this.nextIs("left brace"))
            this.currentScope = new Scope(this.currentScope);
        return this.tokens.shift();
    }
    nextIs(expectedType, expectedValue) {
        if (!expectedValue)
            return this.tokens[0].type === expectedType;
        return this.tokens[0].type === expectedType && this.tokens[0].value === expectedValue;
    }
    nextNextIs(expectedType, expectedValue) {
        if (!expectedValue)
            return this.tokens[1].type === expectedType;
        return this.tokens[1].type === expectedType && this.tokens[1].value === expectedValue;
    }
    parse() {
        let node = { type: "program" };
        if (this.nextIs("keyword", "var"))
            node.varList = this.parseVarList();
        if (this.nextIs("keyword", "fun"))
            node.funList = this.parseFunctionList();
        else {
            let next = this.next();
            throw new TokenError(next, `Unexpected token "${next.value}" - Expected a function list or variable list`);
        }
        return node;
    }
    parseFunctionList() {
        let node = this.parseFunctionDeclaration();
        if (this.nextIs("keyword", "fun"))
            node.next = this.parseFunctionDeclaration();
        return node;
    }
    parseFunctionDeclaration() {
        this.next("keyword", "fun");
        let name = this.next("identifier").value;
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
        if (!(this.nextIs("right brace") || (this.nextIs("newline") && this.nextNextIs("right brace"))))
            body.statementList = this.parseStatementList();
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
        let next = this.next("identifier");
        let identifiers = { type: "identifier list", value: next.value, token: next };
        if (this.nextIs("comma")) {
            this.next("comma");
            identifiers.next = this.parseIdentifierList();
        }
        return identifiers;
    }
    parseVarList(previousNode) {
        let node = { type: "var list" };
        this.next("keyword", "var");
        node.idList = this.parseIdentifierList();
        this.next("newline");
        if (this.nextIs("keyword", "var"))
            node.next = this.parseVarList(node);
        if (!previousNode) {
            let variables = [];
            let searchingNode = node;
            while (searchingNode) {
                let id = searchingNode.idList;
                while (id) {
                    variables.push({ name: id.value, token: id.token });
                    id = id.next;
                }
                searchingNode = searchingNode.next;
            }
            variables.forEach(variable => {
                if (this.currentScope.hasVariableWithName(variable.name))
                    throw new TokenError(variable.token, `Duplicate identifier "${variable.name}"`);
                this.currentScope.variables.push({ name: variable.name, token: variable.token });
            });
        }
        return node;
    }
    parseStatementList() {
        let node = { type: "statement list" };
        if (this.nextIs("newline")) {
            this.next("newline");
            node.next = this.parseStatementList();
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
        if (this.nextIs("keyword", "return")) {
            let node = { type: "return statement" };
            if (this.nextIs("newline")) {
                this.next("newline");
                return node;
            }
            node.expression = this.parseExpression();
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
    parseBinaryExpression() {
        let left = this.parseBitwiseComparisonExpression();
        if (this.nextIs("xor")) {
            let operation = this.parseLiteral().token;
            let right = this.parseBitwiseComparisonExpression();
            let node = {
                type: "binary expression",
                left: left,
                operation: operation,
                right: right
            };
            return node;
        }
        return left;
    }
    parseBitwiseComparisonExpression() {
        let left = this.parseComparisonExpression();
        if (this.nextIs("bitwise comparison")) {
            let operation = this.parseLiteral().token;
            let right = this.parseComparisonExpression();
            let node = {
                type: "binary expression",
                left: left,
                operation: operation,
                right: right
            };
            return node;
        }
        return left;
    }
    parseComparisonExpression() {
        let left = this.parseBitwiseShiftExpression();
        if (this.nextIs("comparison")) {
            let operation = this.parseLiteral().token;
            let right = this.parseBitwiseShiftExpression();
            let node = {
                type: "binary expression",
                left: left,
                operation: operation,
                right: right
            };
            return node;
        }
        return left;
    }
    parseBitwiseShiftExpression() {
        let left = this.parseAdditiveExpression();
        if (this.nextIs("bitwise shift")) {
            let operation = this.parseLiteral().token;
            let right = this.parseAdditiveExpression();
            let node = {
                type: "binary expression",
                left: left,
                operation: operation,
                right: right
            };
            return node;
        }
        return left;
    }
    parseAdditiveExpression() {
        let left = this.parseMultiplicativeExpression();
        if (this.nextIs("additive")) {
            let operation = this.parseLiteral().token;
            let right = this.parseMultiplicativeExpression();
            let node = {
                type: "binary expression",
                left: left,
                operation: operation,
                right: right
            };
            return node;
        }
        return left;
    }
    parseMultiplicativeExpression() {
        let left = this.parseUnaryExpression();
        if (this.nextIs("multiplicative")) {
            let operation = this.parseLiteral().token;
            let right = this.parseUnaryExpression();
            let node = {
                type: "binary expression",
                left: left,
                operation: operation,
                right: right
            };
            return node;
        }
        return left;
    }
    parseExpression() {
        return this.parseBinaryExpression();
    }
    parseUnaryExpression() {
        if (this.nextIs("identifier") && this.nextNextIs("left parentheses")) {
            let literal = this.parseLiteral();
            this.next("left parentheses");
            let node = { type: "function call" };
            node.name = literal.value;
            node.arguments = this.parseExpressionList();
            this.next("right parentheses");
            return node;
        }
        if (this.nextIs("integer") || this.nextIs("character") || this.nextIs("string")) {
            return this.parseLiteral();
        }
        if (this.nextIs("identifier")) {
            let identifier = this.parseLiteral();
            if (!this.currentScope.hasVariableWithName(identifier.value))
                throw new TokenError(identifier.token, `Variable "${identifier.value}" is not defined.`);
            return identifier;
        }
        if (this.nextIs("left parentheses")) {
            this.next("left parentheses");
            let node = { type: "expression" };
            if (!this.nextIs("right parentheses"))
                node.expressionList = this.parseExpressionList();
            this.next("right parentheses");
            return node;
        }
        if (this.nextIs("dot")) {
            let node = { type: "unary operation expression" };
            node.operation = this.next("dot").value;
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
        let next = this.next();
        return { type: next.type, value: next.value, token: next };
    }
    parseExpressionList() {
        let expression = this.parseExpression();
        if (this.nextIs("comma")) {
            this.next("comma");
            expression.next = this.parseExpression();
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
