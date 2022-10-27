"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TokenError = void 0;
const vscode = require("vscode");
const builtins_1 = require("./builtins");
const diagnostics_1 = require("./diagnostics");
function operandsMatch(a, b) {
    if (a === b)
        return true;
    if (a === "any" || b === "any")
        return true;
    if (a === "address" && b === "integer")
        return true;
    if (a === "integer" && b === "address")
        return true;
    return false;
}
class Scope {
    type;
    parent;
    hasUntil = false;
    functions = [];
    variables = [];
    constructor(type, parent) {
        this.type = type;
        this.parent = parent;
        if (this.type === "global") {
            if (this.parent)
                throw "Error: global scope cannot have a parent scope";
            builtins_1.builtInFunctions.forEach(func => this.functions.push({ name: func.name, argumentCount: func.parameterCount }));
        }
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
    diagnostics;
    currentScope = new Scope("global");
    constructor(tokens, diagnostics) {
        this.tokens = tokens;
        this.diagnostics = diagnostics;
    }
    next(expectedType, expectedValue, scopeType) {
        if (expectedType && this.tokens[0].type !== expectedType)
            throw new TokenError(this.tokens[0], `Expected type ${expectedType} but found ${this.tokens[0].type}`);
        if (expectedValue && this.tokens[0].value !== expectedValue)
            throw new TokenError(this.tokens[0], `Expected ${expectedValue} but found ${this.tokens[0].value}`);
        if (this.nextIs("right brace"))
            this.currentScope = this.currentScope.parent;
        else if (this.nextIs("left brace"))
            this.currentScope = new Scope(scopeType, this.currentScope);
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
        let nameToken = this.next("identifier");
        let name = nameToken.value;
        if (name !== "init" && this.currentScope.hasFunctionWithName(name))
            throw new TokenError(nameToken, `There already exists a function with the name "${name}" in the current scope. Choose a different name.`);
        this.next("left parentheses");
        let args = null;
        if (!this.nextIs("right parentheses"))
            args = this.parseIdentifierList();
        this.next("right parentheses");
        this.next("left brace", undefined, "function");
        this.next("newline");
        let node = { type: "function declaration", name: name };
        let scopeFunction = { name: name, argumentCount: -1 };
        this.currentScope.parent.functions.push(scopeFunction);
        let param = args;
        let parameterCount = 0;
        while (param) {
            this.currentScope.variables.push({ name: param.value, token: param.token, type: "any" });
            parameterCount++;
            param = param.next;
        }
        scopeFunction.argumentCount = parameterCount;
        let body = { type: "function body" };
        if (this.nextIs("keyword", "var"))
            body.varList = this.parseVarList();
        if (!(this.nextIs("right brace") || (this.nextIs("newline") && this.nextNextIs("right brace"))))
            body.statementList = this.parseStatementList();
        node.name = name;
        node.body = body;
        this.next("right brace");
        this.next("newline");
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
        if (this.nextNextIs("keyword", "var"))
            node.next = this.parseVarList(node);
        if (!previousNode) {
            let variables = [];
            let searchingNode = node;
            while (searchingNode) {
                let id = searchingNode.idList;
                while (id) {
                    variables.push({ name: id.value, token: id.token, type: "any" });
                    id = id.next;
                }
                searchingNode = searchingNode.next;
            }
            variables.forEach(variable => {
                if (this.currentScope.hasVariableWithName(variable.name))
                    throw new TokenError(variable.token, `Duplicate identifier "${variable.name}"`);
                this.currentScope.variables.push(variable);
            });
        }
        return node;
    }
    parseStatementList() {
        let node = { type: "statement list" };
        node.statement = this.parseStatement();
        if (!this.nextIs("right brace"))
            node.next = this.parseStatementList();
        return node;
    }
    parseStatement() {
        if (this.nextIs("keyword", "if"))
            return this.parseIfStatement();
        if (this.nextIs("keyword", "until")) {
            let node = { type: "until statement" };
            this.next("keyword", "until");
            this.currentScope.hasUntil = true;
            node.expression = this.parseExpression();
            this.next("newline");
            return node;
        }
        if (this.nextIs("keyword", "loop")) {
            let node = { type: "loop" };
            let loopKeyword = this.next("keyword", "loop");
            this.next("left brace", undefined, "loop");
            this.next("newline");
            if (!this.nextIs("right brace"))
                node.body = this.parseStatementList();
            if (!this.currentScope.hasUntil)
                throw new TokenError(loopKeyword, "Infinite loop: Loop statement is missing \`until\` statement.");
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
            this.next("colon");
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
        throw new TokenError(this.tokens[0], `Unexpected token "${this.next().value}" - Expected a statement.`);
    }
    parseBinaryExpression() {
        let node = this.parseBitwiseComparisonExpression();
        while (this.nextIs("xor")) {
            let left = node;
            let operation = this.parseLiteral().token;
            let right = this.parseBitwiseComparisonExpression();
            if (!operandsMatch(node.returnType, right.returnType))
                throw new TokenError(operation, `Cannot XOR a${/^[aeiou]/.test(left.returnType) ? "n" : ""} ${left.returnType} with a${/^[aeiou]/.test(right.returnType) ? "n" : ""} ${right.returnType}`);
            if (left.returnType === "address" || right.returnType === "address")
                (0, diagnostics_1.tokenNonError)(this.diagnostics, operation, `Unsafe pointer arithmetic. Did you mean to get the value stored at a memory location with "."?`, vscode.DiagnosticSeverity.Warning);
            node = {
                type: "binary expression",
                returnType: "integer",
                left: left,
                operation: operation,
                right: right
            };
        }
        return node;
    }
    parseBitwiseComparisonExpression() {
        let node = this.parseComparisonExpression();
        while (this.nextIs("bitwise comparison")) {
            let left = node;
            let operation = this.parseLiteral().token;
            let right = this.parseComparisonExpression();
            if (!operandsMatch(node.returnType, right.returnType))
                throw new TokenError(operation, `Cannot bitwise compare a${/^[aeiou]/.test(left.returnType) ? "n" : ""} ${left.returnType} to a${/^[aeiou]/.test(right.returnType) ? "n" : ""} ${right.returnType}`);
            if (left.returnType === "address" || right.returnType === "address")
                (0, diagnostics_1.tokenNonError)(this.diagnostics, operation, `Unsafe pointer arithmetic. Did you mean to get the value stored at a memory location with "."?`, vscode.DiagnosticSeverity.Warning);
            node = {
                type: "binary expression",
                returnType: "boolean",
                left: left,
                operation: operation,
                right: right
            };
        }
        return node;
    }
    parseComparisonExpression() {
        let node = this.parseBitwiseShiftExpression();
        while (this.nextIs("comparison")) {
            let left = node;
            let operation = this.parseLiteral().token;
            let right = this.parseBitwiseShiftExpression();
            if (!operandsMatch(node.returnType, right.returnType))
                throw new TokenError(operation, `Cannot compare a${/^[aeiou]/.test(left.returnType) ? "n" : ""} ${left.returnType} to a${/^[aeiou]/.test(right.returnType) ? "n" : ""} ${right.returnType}`);
            node = {
                type: "binary expression",
                returnType: "boolean",
                left: left,
                operation: operation,
                right: right
            };
        }
        return node;
    }
    parseBitwiseShiftExpression() {
        let node = this.parseAdditiveExpression();
        while (this.nextIs("bitwise shift")) {
            let left = node;
            let operation = this.parseLiteral().token;
            let right = this.parseAdditiveExpression();
            if (!operandsMatch(node.returnType, right.returnType))
                throw new TokenError(operation, `Cannot shift a${/^[aeiou]/.test(left.returnType) ? "n" : ""} ${left.returnType} by a${/^[aeiou]/.test(right.returnType) ? "n" : ""} ${right.returnType}`);
            if (left.returnType === "address" || right.returnType === "address")
                (0, diagnostics_1.tokenNonError)(this.diagnostics, operation, `Unsafe pointer arithmetic. Did you mean to get the value stored at a memory location with "."?`, vscode.DiagnosticSeverity.Warning);
            node = {
                type: "binary expression",
                returnType: "integer",
                left: left,
                operation: operation,
                right: right
            };
        }
        return node;
    }
    parseAdditiveExpression() {
        let node = this.parseMultiplicativeExpression();
        while (this.nextIs("additive")) {
            let left = node;
            let operation = this.parseLiteral().token;
            let right = this.parseMultiplicativeExpression();
            if (!operandsMatch(node.returnType, right.returnType))
                throw new TokenError(operation, `Cannot add a${/^[aeiou]/.test(left.returnType) ? "n" : ""} ${left.returnType} by a${/^[aeiou]/.test(right.returnType) ? "n" : ""} ${right.returnType}`);
            if (left.returnType === "address" || right.returnType === "address")
                (0, diagnostics_1.tokenNonError)(this.diagnostics, operation, `Unsafe pointer arithmetic. Did you mean to get the value stored at a memory location with "."?`, vscode.DiagnosticSeverity.Warning);
            node = {
                type: "binary expression",
                returnType: "integer",
                left: left,
                operation: operation,
                right: right
            };
        }
        return node;
    }
    parseMultiplicativeExpression() {
        let node = this.parseUnaryExpression();
        while (this.nextIs("multiplicative")) {
            let left = node;
            let operation = this.parseLiteral().token;
            let right = this.parseUnaryExpression();
            if (!operandsMatch(node.returnType, right.returnType))
                throw new TokenError(operation, `Cannot multiply a${/^[aeiou]/.test(left.returnType) ? "n" : ""} ${left.returnType} by a${/^[aeiou]/.test(right.returnType) ? "n" : ""} ${right.returnType}`);
            if (left.returnType === "address" || right.returnType === "address")
                (0, diagnostics_1.tokenNonError)(this.diagnostics, operation, `Unsafe pointer arithmetic. Did you mean to get the value stored at a memory location with "."?`, vscode.DiagnosticSeverity.Warning);
            node = {
                type: "binary expression",
                returnType: "integer",
                left: left,
                operation: operation,
                right: right
            };
        }
        return node;
    }
    parseExpression() {
        return this.parseBinaryExpression();
    }
    parseUnaryExpression() {
        if (this.nextIs("identifier") && this.nextNextIs("left parentheses")) {
            let literal = this.parseLiteral();
            this.next("left parentheses");
            let node = { type: "function call", name: literal.value };
            let argumentCount = 0;
            if (!this.nextIs("right parentheses")) {
                node.arguments = this.parseExpressionList();
                let arg = node.arguments;
                while (arg) {
                    argumentCount++;
                    arg = arg.next;
                }
            }
            if (!this.currentScope.hasFunctionWithName(node.name))
                throw new TokenError(literal.token, `Function "${node.name}" is undefined`);
            let scopeFunction = this.currentScope.allFunctions.find(func => func.name === node.name);
            if (scopeFunction.argumentCount !== argumentCount)
                throw new TokenError(literal.token, `Incorrect number of arguments: Expected ${scopeFunction.argumentCount} argument${scopeFunction.argumentCount === 1 ? "" : "s"} but received ${argumentCount}`);
            this.next("right parentheses");
            return {
                type: node.type,
                returnType: "any",
                left: node,
                operation: literal.token
            };
        }
        if (this.nextIs("integer") || this.nextIs("character") || this.nextIs("string")) {
            let literal = this.parseLiteral();
            return {
                ...literal,
                ...{
                    returnType: literal.token.type,
                    left: literal,
                    operation: literal.token
                }
            };
        }
        if (this.nextIs("identifier")) {
            let identifier = this.parseLiteral();
            if (!this.currentScope.hasVariableWithName(identifier.value)) {
                throw new TokenError(identifier.token, `Variable "${identifier.value}" is not defined.`);
            }
            return {
                ...identifier,
                ...{
                    returnType: "address",
                    left: identifier,
                    operation: identifier.token
                }
            };
        }
        if (this.nextIs("left parentheses")) {
            let operation = this.next("left parentheses");
            let node = { type: "expression" };
            if (!this.nextIs("right parentheses"))
                node.expression = this.parseUnaryExpression();
            this.next("right parentheses");
            return {
                ...node,
                operation: operation,
                left: node,
                returnType: node.expression.returnType
            };
        }
        if (this.nextIs("dot")) {
            console.log(this.tokens);
            let operation = this.next('dot');
            let expression = this.parseUnaryExpression();
            console.log("AFTER", this.tokens);
            let node = {
                type: "dereference",
                operation: operation,
                left: expression,
                returnType: "any"
            };
            return node;
        }
        if (this.nextIs("minus")) {
            let node = {
                type: "negation",
                operation: this.next("minus"),
                left: this.parseUnaryExpression(),
                returnType: "integer"
            };
            return node;
        }
        if (this.nextIs("bitwise not")) {
            let node = {
                type: "bitwise negation",
                operation: this.next("bitwise not"),
                left: this.parseUnaryExpression(),
                returnType: "integer"
            };
            return node;
        }
        let next = this.next();
        throw new TokenError(next, `Unexpected token: "${next.value.replace(/\n/g, "\\n")}" - Expected expression.`);
    }
    parseLiteral() {
        let next = this.next();
        if (next.type === "string") {
            let val = next.value.replace(/\\/g, "\\\\");
            let escapeRegex = /[^\\]\\(\.)/;
            let match = escapeRegex.exec(val);
            while (match) {
                let char = match[1];
                if (!(char === "b" || char === "n" || char === "r" || char === "t" || char === "\\")) {
                    throw new TokenError(next, `Invalid escape sequence "\\${char}". Supported escape sequences are \\b, \\n, \\r, \\t, and \\\\`);
                }
                match = escapeRegex.exec(val);
            }
        }
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
        this.next("left brace", undefined, "if");
        this.next("newline");
        node.body = this.parseStatementList();
        this.next("right brace");
        this.next("newline");
        if (this.nextIs("keyword", "else")) {
            if (this.nextIs("keyword", "if"))
                node.elseBody = this.parseIfStatement();
            else if (this.nextIs("left brace")) {
                this.next("left brace", undefined, "else");
                this.next("newline");
                node.elseBody = this.parseStatementList();
                this.next("right brace");
            }
        }
        return node;
    }
}
exports.default = Parser;
