import * as vscode from "vscode";
import { builtInFunctions } from "./builtins";
import { tokenNonError } from "./diagnostics";
import { Token, tokenTypes } from "./lexer";

/**
 * A node in an abstract syntax tree (or the tree itself).
 */
interface ASTNode {
    type: string;
}

type ArithmeticNode = ASTNode & { left: ASTNode, operation: Token, right?: ASTNode, returnType: TranquilityType };
type ExpressionListNode = ASTNode & { next?: ASTNode };
type ExpressionNode = ASTNode & { resultType?: TranquilityType };
type IdListNode = ASTNode & { value: string, token: Token, next?: IdListNode };
type FunDeclNode = ASTNode & { name?: string, body?: ASTNode, arguments?: IdListNode };

type TranquilityType = "any" | "string" | "integer" | "boolean" | "address";

function operandsMatch(a: TranquilityType, b: TranquilityType): boolean {
    if (a === b) return true;
    if (a === "any" || b === "any") return true;
    if (a === "address" && b === "integer") return true;
    if (a === "integer" && b === "address") return true;
    return false;
}

type ScopeType = "function" | "loop" | "if" | "global" | "else";

class Scope {

    hasUntil = false;
    functions: { name: string, argumentCount: number }[] = [];
    variables: { name: string, token: Token, type: TranquilityType }[] = [];

    /**
     * Creates a new `Scope` as a child of the parent scope if given.
     * 
     * @param parent The parent scope
     */
    constructor(public readonly type: ScopeType, public readonly parent?: Scope) {
        if (this.type === "global") {
            if (this.parent) throw "Error: global scope cannot have a parent scope";
            builtInFunctions.forEach(func => this.functions.push({ name: func.name, argumentCount: func.parameterCount }));
        }
    }

    /**
     * All functions in this scope, as well as any parent of this scope (direct or not)
     */
    get allFunctions(): { name: string, argumentCount: number }[] {
        let all: { name: string, argumentCount: number }[] = [];
        let scope: Scope | undefined = this;
        while (scope) {
            scope.functions.forEach(func => all.push(func));
            scope = scope.parent;
        }
        return all;
    }

    /**
     * All variables in this scope, as well as any parent of this scope (direct or not)
     */
    get allVariables(): { name: string, token: Token }[] {
        let all: { name: string, token: Token }[] = [];
        let scope: Scope | undefined = this;
        while (scope) {
            scope.variables.forEach(variable => all.push(variable));
            scope = scope.parent;
        }
        return all;
    }

    /**
     * Returns whether or not a variable exists in the current scope (or one of its parents) with the given name.
     * 
     * @param name The variable name to search for
     * 
     * @return whether or not a variable exists with the given name.
     */
    hasVariableWithName(name: string): boolean {
        return this.allVariables.map(variable => variable.name).includes(name);
    }

    /**
     * Returns whether or not a function exists in the current scope (or one of its parents) with the given name.
     * 
     * @param name The function name to search for
     * 
     * @return whether or not a function exists with the given name.
     */
    hasFunctionWithName(name: string): boolean {
        return this.allFunctions.map(func => func.name).includes(name);
    }
}

/**
 * An `Error` that is tied to a token and has a severity. Used to create diagnostics at the tokens position.
 */
export class TokenError extends Error {

    /**
     * Creates a new TokenError
     * 
     * @param token The token to highlight
     * @param message The error message
     * @param severity The error severity
     */
    constructor(public readonly token: Token, message: string, public readonly severity: vscode.DiagnosticSeverity = vscode.DiagnosticSeverity.Error) {
        super(message);
    }
}

/**
 * A `Parser` takes a list of tokens and converts it into an abstract syntax tree (AST) node.
 */
export default class Parser {

    /**
     * The current scope of the parser.
     */
    private currentScope: Scope = new Scope("global");

    /** 
     * Creates a new parser.
     * 
     * @param tokens The tokens to parse. 
     */
    constructor(public readonly tokens: Token[], private readonly diagnostics: vscode.Diagnostic[]) { }

    /**
     * Removes and returns the next token. If the token is a left brace, a new `Scope` is created and set to the {@link currentScope}.
     * If the token is a right brace, the current scope is set to the parent of the current scope.
     * 
     * @param expectedType The expected type of the next token. If it does not match, a {@link TokenError} is thrown.
     * @param expectedValue The expected value of the next token. If it does not match, a {@link TokenError} is thrown.
     * 
     * @returns The removed token.
     */
    private next(expectedType?: keyof typeof tokenTypes, expectedValue?: string, scopeType?: ScopeType): Token {
        if (expectedType && this.tokens[0].type !== expectedType) throw new TokenError(this.tokens[0], `Expected type ${expectedType} but found ${this.tokens[0].type}`);
        if (expectedValue && this.tokens[0].value !== expectedValue) throw new TokenError(this.tokens[0], `Expected ${expectedValue} but found ${this.tokens[0].value}`);

        // If the next token is a right brace, exit the current scope and return the current scope to the parent.
        if (this.nextIs("right brace")) this.currentScope = this.currentScope.parent!;

        // If the next token is a left brace, enter a new scope with the old scope as the parent.
        else if (this.nextIs("left brace")) this.currentScope = new Scope(scopeType!, this.currentScope);

        return this.tokens.shift()!;
    }

    /**
     * Checks if the next token matches the given type and value if given without removing it.
     * 
     * @param expectedType The type of token to expect
     * @param expectedValue The value to expect
     * 
     * @returns whether or not the next token matches the given type and value if given.
     */
    private nextIs(expectedType: keyof typeof tokenTypes, expectedValue?: string): boolean {
        if (!expectedValue) return this.tokens[0].type === expectedType;
        return this.tokens[0].type === expectedType && this.tokens[0].value === expectedValue;
    }

    /**
     * Checks if the token after the next token matches the given type and value if given without removing it.
     * 
     * @param expectedType The type of token to expect
     * @param expectedValue The value to expect
     * 
     * @returns whether or not the token after the next one matches the given type and value if given.
     */
    private nextNextIs(expectedType: keyof typeof tokenTypes, expectedValue?: string): boolean {
        if (!expectedValue) return this.tokens[1].type === expectedType;
        return this.tokens[1].type === expectedType && this.tokens[1].value === expectedValue;
    }

    /**
     * Parses a program.
     * 
     * Syntax:
     * 
     * ```tranquility
     * <program> ::= 
     *      e |
     *      <var-list> | 
     *      <fun-list> |
     *      <var-list> <fun-list>
     * ```
     * 
     * @returns The parsed node.
     * 
     * @see `<var-list>`: {@link parseVarList VariableList}
     * @see `<fun-list>`: {@link parseFunctionList FunctionList}
     */
    parse(): ASTNode {
        let node: ASTNode & { varList?: ASTNode, funList?: ASTNode } = { type: "program" };
        if (this.nextIs("keyword", "var")) node.varList = this.parseVarList();
        if (this.nextIs("keyword", "fun")) node.funList = this.parseFunctionList();
        else {
            let next = this.next();
            throw new TokenError(next, `Unexpected token "${next.value}" - Expected a function list or variable list`);
        }
        return node;
    }

    /**
     * Parses a function list.
     * 
     * Syntax:
     * 
     * ```tranquility
     * <fun-list> ::= 
     *      <fun-decl> | 
     *      <fun-decl> <fun-list>
     * ```
     * 
     * @returns The parsed node.
     * 
     * @see `<fun-decl>`: {@link parseFunctionDeclaration FunctionDeclaration}
     */
    private parseFunctionList(): ASTNode {
        let node: FunDeclNode & { next?: FunDeclNode } = this.parseFunctionDeclaration();
        if (this.nextIs("keyword", "fun")) node.next = this.parseFunctionDeclaration();
        return node;
    }

    /**
     * Parses a function declaration.
     * 
     * Syntax:
     * 
     * ```tranquility
     * <fun-decl> ::= 
     *      "fun" IDENTIFIER "(" <id-list>? ")" "{" "\n" <var-list> <stmt-list> "}" "\n"
     * ```
     * 
     * @returns The parsed node.
     * @see `<id-list>`: {@link parseIdentifierList IdentifierList}
     */
    private parseFunctionDeclaration(): FunDeclNode {
        this.next("keyword", "fun");
        let nameToken = this.next("identifier");
        let name = nameToken.value;
        if (name !== "init" && this.currentScope.hasFunctionWithName(name)) throw new TokenError(nameToken, `There already exists a function with the name "${name}" in the current scope. Choose a different name.`);

        this.next("left parentheses");
        let args: IdListNode | null = null;
        if (!this.nextIs("right parentheses")) args = this.parseIdentifierList();

        this.next("right parentheses");
        this.next("left brace", undefined, "function");
        this.next("newline");

        let node: FunDeclNode = { type: "function declaration", name: name };
        let scopeFunction = { name: name, argumentCount: -1 }
        this.currentScope.parent!.functions.push(scopeFunction);

        let param = args;
        let parameterCount = 0;
        while (param) {
            this.currentScope.variables.push({ name: param.value, token: param.token, type: "any" });
            parameterCount++;
            param = param.next!;
        }

        scopeFunction.argumentCount = parameterCount;

        let body: ASTNode & { varList?: ASTNode, statementList?: ASTNode } = { type: "function body" };
        if (this.nextIs("keyword", "var")) body.varList = this.parseVarList();
        if (!(this.nextIs("right brace") || (this.nextIs("newline") && this.nextNextIs("right brace")))) body.statementList = this.parseStatementList();

        node.name = name;
        node.body = body;
        this.next("right brace");
        this.next("newline");
        return node;
    }

    /**
     * Parses an identifier list.
     * 
     * Syntax:
     * 
     * ```tranquility
     * <id-list> ::= 
     *      IDENTIFIER |
     *      IDENTIFIER "," <id-list>
     * ```
     * 
     * @returns The parsed node.
     */
    private parseIdentifierList(): IdListNode {
        let next = this.next("identifier");
        let identifiers: IdListNode = { type: "identifier list", value: next.value, token: next };
        if (this.nextIs("comma")) {
            this.next("comma");
            identifiers.next = this.parseIdentifierList();
        }
        return identifiers;
    }

    /**
     * Parses a variable list.
     * 
     * Syntax:
     * 
     * ```tranquility
     * <var-list> ::= 
     *      "var" <id-list> "\n" |
     *      "var" <id-list> "\n" <var-list>
     * ```
     * 
     * @returns The parsed node.
     * 
     * @see `<id-list>`: {@link parseIdentifierList IdentifierList}
     */
    private parseVarList(previousNode?: ASTNode): ASTNode {
        let node: ASTNode & { idList?: IdListNode, next?: ASTNode } = { type: "var list" };
        this.next("keyword", "var");
        node.idList = this.parseIdentifierList();
        this.next("newline");
        if (this.nextNextIs("keyword", "var")) node.next = this.parseVarList(node);

        // Only check variables if the node is complete, ie., all sub-nodes are generated and no sub-nodes call this
        if (!previousNode) {
            let variables: { name: string, token: Token, type: TranquilityType }[] = [];
            let searchingNode = node;
            while (searchingNode) {
                let id = searchingNode.idList!;
                while (id) {
                    variables.push({ name: id.value, token: id.token, type: "any" });
                    id = id.next!;
                }
                searchingNode = searchingNode.next!;
            }

            // Add the variables to the current scope
            variables.forEach(variable => {
                if (this.currentScope.hasVariableWithName(variable.name)) throw new TokenError(variable.token, `Duplicate identifier "${variable.name}"`);
                this.currentScope.variables.push(variable);
            });
        }

        return node;
    }

    /**
     * Parses a statement list.
     * 
     * Syntax:
     * 
     * ```tranquility
     * <stmt-list> ::= 
     *      :\n" <stmt-list> |
     *      <stmt> <stmt-list>
     * ```
     * 
     * @returns The parsed node.
     * @see `<stmt>`: {@link parseStatement Statement}
     */
    private parseStatementList(): ASTNode {
        let node: ASTNode & { next?: ASTNode, statement?: ASTNode } = { type: "statement list" };
        node.statement = this.parseStatement();
        if (!this.nextIs("right brace")) node.next = this.parseStatementList();
        return node;
    }

    /**
     * Parses a statement;
     * 
     * Syntax:
     * 
     * ```tranquility
     * <stmt> ::= 
     *      <expr> ":" <expr> |
     *      <expr> |
     *      <if-stmt> |
     *      "until" <expr> |
     *      "loop" "{" "\n" <stmt-list> "}" |
     *      "return" |
     *      "return" <expr>
     * ```
     * 
     * @returns The parsed node.
     * 
     * @see `<expr>`: {@link parseExpression Expression}
     * @see `<if-stmt>`: {@link parseIfStatement IfStatement}
     * @see `<stmt-list>`: {@link parseStatementList StatementList}
     */
    private parseStatement(): ASTNode {

        // If statement
        if (this.nextIs("keyword", "if")) return this.parseIfStatement();

        // Until statement
        if (this.nextIs("keyword", "until")) {
            let node: ASTNode & { expression?: ASTNode } = { type: "until statement" };
            this.next("keyword", "until");
            this.currentScope.hasUntil = true;
            node.expression = this.parseExpression();
            this.next("newline");
            return node;
        }

        // Loop statement
        if (this.nextIs("keyword", "loop")) {
            let node: ASTNode & { body?: ASTNode } = { type: "loop" };
            let loopKeyword = this.next("keyword", "loop");
            this.next("left brace", undefined, "loop");
            this.next("newline");
            if (!this.nextIs("right brace")) node.body = this.parseStatementList();
            if (!this.currentScope.hasUntil) throw new TokenError(loopKeyword, "Infinite loop: Loop statement is missing \`until\` statement.");
            this.next("right brace");
            this.next("newline");
            return node;
        }

        // Return statement
        if (this.nextIs("keyword", "return")) {
            let node: ASTNode & { expression?: ASTNode } = { type: "return statement" };
            if (this.nextIs("newline")) {
                this.next("newline");
                return node;
            }
            node.expression = this.parseExpression();
            this.next("newline");
            return node;
        }

        let expression = this.parseExpression();

        // Assignment statement
        if (this.nextIs("colon")) {
            this.next("colon");
            let node: ASTNode & { expression1?: ASTNode, expression2?: ASTNode } = { type: "assignment" };
            node.expression1 = expression;
            node.expression2 = this.parseExpression();
            this.next("newline");
            return node;
        }

        // Single expression 
        if (this.nextIs("newline")) {
            let node: ASTNode & { expression?: ASTNode } = { type: "expression statement" };
            node.expression = expression;
            this.next("newline");
            return node;
        }

        throw new TokenError(this.tokens[0], `Unexpected token "${this.next().value}" - Expected a statement.`);
    }

    /**
     * Parses a binary expression.
     * 
     * Syntax:
     * 
     * ```tranquility
     * <bexpr> ::= 
     *      <bcexpr> ^ <bcexpr> |
     *      <bcexpr>
     * ```
     * 
     * @returns The parsed node.
     * @see `<bcexpr>`: {@link parseBitwiseComparisonExpression BitwiseComparisonExpression}
     */
    private parseBinaryExpression(): ArithmeticNode {
        let node = this.parseBitwiseComparisonExpression();
        while (this.nextIs("xor")) {

            // Set the LHS to the node and parse the operation and RHS
            let left = node;
            let operation = this.parseLiteral().token;
            let right = this.parseBitwiseComparisonExpression();
            
            // Check arithmetic
            if (!operandsMatch(node.returnType, right.returnType)) throw new TokenError(operation, `Cannot XOR a${/^[aeiou]/.test(left.returnType) ? "n" : ""} ${left.returnType} with a${/^[aeiou]/.test(right.returnType) ? "n" : ""} ${right.returnType}`);
            if (left.returnType === "address" || right.returnType === "address") tokenNonError(this.diagnostics, operation, `Unsafe pointer arithmetic. Did you mean to get the value stored at a memory location with "."?`, vscode.DiagnosticSeverity.Warning);
            
            // Reconstruct the node with the LHS, operation, and RHS.
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

    /**
     * Parses a bitwise comparison expression.
     * 
     * Syntax:
     * 
     * ```tranquility
     * <bcexpr> ::= 
     *      <cexpr> & <cexpr> |
     *      <cexpr> | <cexpr> |
     *      <cexpr>
     * ```
     * 
     * @returns The parsed node.
     * @see `<cexpr>`: {@link parseComparisonExpression ComparisonExpression}
     */
    private parseBitwiseComparisonExpression(): ArithmeticNode {
        let node = this.parseComparisonExpression();
        while (this.nextIs("bitwise comparison")) {

            // Set the LHS to the node and parse the operation and RHS
            let left = node;
            let operation = this.parseLiteral().token;
            let right = this.parseComparisonExpression();
            
            // Check arithmetic
            if (!operandsMatch(node.returnType, right.returnType)) throw new TokenError(operation, `Cannot bitwise compare a${/^[aeiou]/.test(left.returnType) ? "n" : ""} ${left.returnType} to a${/^[aeiou]/.test(right.returnType) ? "n" : ""} ${right.returnType}`);
            if (left.returnType === "address" || right.returnType === "address") tokenNonError(this.diagnostics, operation, `Unsafe pointer arithmetic. Did you mean to get the value stored at a memory location with "."?`, vscode.DiagnosticSeverity.Warning);
            
            // Reconstruct the node with the LHS, operation, and RHS.
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

    /**
     * Parses a comparison expression.
     * 
     * Syntax:
     * 
     * ```tranquility
     * <cexpr> ::= 
     *      <bsexpr> == <bsexpr> |
     *      <bsexpr> != <bsexpr> |
     *      <bsexpr> < <bsexpr> |
     *      <bsexpr> > <bsexpr> |
     *      <bsexpr> <= <bsexpr> |
     *      <bsexpr> >= <bsexpr> |
     *      <bsexpr>
     * ```
     * 
     * @returns The parsed node.
     * @see `<bsexpr>`: {@link parseBitwiseShiftExpression BitwiseShiftExpression}
     */
    private parseComparisonExpression(): ArithmeticNode {
        let node = this.parseBitwiseShiftExpression();
        while (this.nextIs("comparison")) {

            // Set the LHS to the node and parse the operation and RHS
            let left = node;
            let operation = this.parseLiteral().token;
            let right = this.parseBitwiseShiftExpression();
            
            // Check arithmetic
            if (!operandsMatch(node.returnType, right.returnType)) throw new TokenError(operation, `Cannot compare a${/^[aeiou]/.test(left.returnType) ? "n" : ""} ${left.returnType} to a${/^[aeiou]/.test(right.returnType) ? "n" : ""} ${right.returnType}`);
            
            // Reconstruct the node with the LHS, operation, and RHS.
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

    /**
     * Parses a bitwise-shift expression.
     * 
     * Syntax:
     * 
     * ```tranquility
     * <bsexpr> ::= 
     *      <aexpr> << <aexpr> |
     *      <aexpr> >> <aexpr> |
     *      <aexpr>
     * ```
     * 
     * @returns The parsed node.
     * @see `<aexpr>`: {@link parseAdditiveExpression AdditiveExpression}
     */
    private parseBitwiseShiftExpression(): ArithmeticNode {
        let node = this.parseAdditiveExpression();
        while (this.nextIs("bitwise shift")) {

            // Set the LHS to the node and parse the operation and RHS
            let left = node;
            let operation = this.parseLiteral().token;
            let right = this.parseAdditiveExpression();
            
            // Check arithmetic
            if (!operandsMatch(node.returnType, right.returnType)) throw new TokenError(operation, `Cannot shift a${/^[aeiou]/.test(left.returnType) ? "n" : ""} ${left.returnType} by a${/^[aeiou]/.test(right.returnType) ? "n" : ""} ${right.returnType}`);
            if (left.returnType === "address" || right.returnType === "address") tokenNonError(this.diagnostics, operation, `Unsafe pointer arithmetic. Did you mean to get the value stored at a memory location with "."?`, vscode.DiagnosticSeverity.Warning);
            
            // Reconstruct the node with the LHS, operation, and RHS.
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

    /**
     * Parses an additive expression.
     * 
     * Syntax:
     * 
     * ```tranquility
     * <aexpr> ::= 
     *      <mexpr> + <mexpr> |
     *      <mexpr> - <mexpr> |
     *      <mexpr>
     * ```
     * 
     * @returns The parsed node.
     * 
     * @see `<mexpr>`: {@link parseMultiplicativeExpression MultiplicativeExpression}
     */
    private parseAdditiveExpression(): ArithmeticNode {
        let node = this.parseMultiplicativeExpression();
        while (this.nextIs("additive")) {

            // Set the LHS to the node and parse the operation and RHS
            let left = node;
            let operation = this.parseLiteral().token;
            let right = this.parseMultiplicativeExpression();
            
            // Check arithmetic
            if (!operandsMatch(node.returnType, right.returnType)) throw new TokenError(operation, `Cannot add a${/^[aeiou]/.test(left.returnType) ? "n" : ""} ${left.returnType} by a${/^[aeiou]/.test(right.returnType) ? "n" : ""} ${right.returnType}`);
            if (left.returnType === "address" || right.returnType === "address") tokenNonError(this.diagnostics, operation, `Unsafe pointer arithmetic. Did you mean to get the value stored at a memory location with "."?`, vscode.DiagnosticSeverity.Warning);
            
            // Reconstruct the node with the LHS, operation, and RHS.
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

    /**
     * Parses a multiplicative expression.
     * 
     * Syntax:
     * 
     * ```tranquility
     * <mexpr> ::= 
     *      <uexpr> * <uexpr> |
     *      <uexpr> / <uexpr> |
     *      <uexpr> % <uexpr> |
     *      <uexpr>
     * ```
     * 
     * @returns The parsed node.
     * @see `<uexpr>`: {@link parseUnaryExpression UnaryExpression}
     */
    private parseMultiplicativeExpression(): ArithmeticNode {
        let node = this.parseUnaryExpression();
        while (this.nextIs("multiplicative")) {

            // Set the LHS to the node and parse the operation and RHS
            let left = node;
            let operation = this.parseLiteral().token;
            let right = this.parseUnaryExpression();
            
            // Check arithmetic
            if (!operandsMatch(node.returnType, right.returnType)) throw new TokenError(operation, `Cannot multiply a${/^[aeiou]/.test(left.returnType) ? "n" : ""} ${left.returnType} by a${/^[aeiou]/.test(right.returnType) ? "n" : ""} ${right.returnType}`);
            if (left.returnType === "address" || right.returnType === "address") tokenNonError(this.diagnostics, operation, `Unsafe pointer arithmetic. Did you mean to get the value stored at a memory location with "."?`, vscode.DiagnosticSeverity.Warning);
            
            // Reconstruct the node with the LHS, operation, and RHS.
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

    /** 
     * Parses an expression.
     * @returns The parsed node.
     */
    private parseExpression(): ArithmeticNode {
        return this.parseBinaryExpression();
    }

    /**
     * Parses a unary expression. Contrary to its name, this parses more than just unary expressions, specifically:
     * - Unary operations: `-<expr>, ~<expr>, .<expr>`
     * - Literals: `<integer>, <string>, <character>, <identifier>`
     * - Function calls: `<identifier>(<arguments>)`
     * - Parenthesized expressions: `(<expr>)`
     * 
     * @returns The parsed node
     */
    private parseUnaryExpression(): ArithmeticNode {

        // Function call
        if (this.nextIs("identifier") && this.nextNextIs("left parentheses")) {

            // Create node with function name
            let literal = this.parseLiteral();
            this.next("left parentheses");
            let node: ASTNode & { name: string, arguments?: ExpressionListNode } = { type: "function call", name: literal.value };

            // Get number of arguments and parse them
            let argumentCount = 0;
            if (!this.nextIs("right parentheses")) {
                node.arguments = this.parseExpressionList();
                let arg = node.arguments;
                while (arg) {
                    argumentCount++;
                    arg = arg.next!;
                }
            }

            // Error if function does not exist
            if (!this.currentScope.hasFunctionWithName(node.name)) throw new TokenError(literal.token, `Function "${node.name}" is undefined`);

            // Error if calling with incorrect number of arguments
            let scopeFunction = this.currentScope.allFunctions.find(func => func.name === node.name)!;
            if (scopeFunction.argumentCount !== argumentCount) throw new TokenError(literal.token, `Incorrect number of arguments: Expected ${scopeFunction.argumentCount} argument${scopeFunction.argumentCount === 1 ? "" : "s"} but received ${argumentCount}`);

            this.next("right parentheses");
            return {
                type: node.type,
                returnType: "any",
                left: node,
                operation: literal.token
            };
        }

        // Literal Expression
        if (this.nextIs("integer") || this.nextIs("character") || this.nextIs("string")) {
            let literal = this.parseLiteral();
            return { // Not the cleanest but it works for now
                ...literal,
                ...{
                    returnType: literal.token.type as TranquilityType,
                    left: literal,
                    operation: literal.token
                }
            };
        }

        // Literal Identifier
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

        // Parenthesized expression
        if (this.nextIs("left parentheses")) {
            let operation = this.next("left parentheses");
            let node: ExpressionNode & { expression?: ArithmeticNode } = { type: "expression" };
            if (!this.nextIs("right parentheses")) node.expression = this.parseUnaryExpression();
            this.next("right parentheses");
            return {
                ...node,
                operation: operation,
                left: node,
                returnType: node.expression!.returnType
            }
        }

        // Dereferencing
        if (this.nextIs("dot")) {
            console.log(this.tokens);
            let operation = this.next('dot');
            let expression = this.parseUnaryExpression();
            console.log("AFTER", this.tokens);
            let node: ArithmeticNode = {
                type: "dereference",
                operation: operation,
                left: expression,
                returnType: "any"
            };
            return node;
        }

        // Unary negation
        if (this.nextIs("minus")) {
            let node: ArithmeticNode = {
                type: "negation",
                operation: this.next("minus"),
                left: this.parseUnaryExpression(),
                returnType: "integer"
            };
            return node;
        }

        // Bitwise negation
        if (this.nextIs("bitwise not")) {
            let node: ArithmeticNode = {
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

    private parseLiteral(): ASTNode & { value: string, token: Token } {
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

    private parseExpressionList(): ExpressionListNode {
        let expression: ExpressionListNode = this.parseExpression();
        if (this.nextIs("comma")) {
            this.next("comma");
            expression.next = this.parseExpression();
        }
        return expression;
    }

    private parseIfStatement(): ASTNode {
        let node: ASTNode & { condition?: ASTNode, body?: ASTNode, elseBody?: ASTNode } = { type: "if statement" };
        this.next("keyword", "if");
        node.condition = this.parseExpression();
        this.next("left brace", undefined, "if");
        this.next("newline");
        node.body = this.parseStatementList();
        this.next("right brace");
        this.next("newline"); //huh

        if (this.nextIs("keyword", "else")) {
            if (this.nextIs("keyword", "if")) node.elseBody = this.parseIfStatement();
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
