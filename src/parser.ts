import * as vscode from "vscode";
import { Token, tokenTypes } from "./lexer";

/**
 * A node in an abstract syntax tree (or the tree itself).
 */
interface ASTNode {
    type: string;
}

type IdListNode = ASTNode & { value: string, token: Token, next?: IdListNode };

class Scope {
    functions: { name: string, argumentCount: number }[] = [];
    variables: { name: string, token: Token }[] = [];

    constructor(public readonly parent?: Scope) { }

    get allFunctions(): { name: string, argumentCount: number }[] {
        let all: { name: string, argumentCount: number }[] = [];
        let scope: Scope | undefined = this;
        while (scope) {
            scope.functions.forEach(func => all.push(func));
            scope = scope.parent;
        }
        return all;
    }

    get allVariables(): { name: string, token: Token }[] {
        let all: { name: string, token: Token }[] = [];
        let scope: Scope | undefined = this;
        while (scope) {
            scope.variables.forEach(variable => all.push(variable));
            scope = scope.parent;
        }
        return all;
    }

    hasVariableWithName(name: string): boolean {
        return this.allVariables.map(variable => variable.name).includes(name);
    }

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
    private currentScope: Scope = new Scope();

    /** 
     * Creates a new parser.
     * 
     * @param tokens The tokens to parse. 
     */
    constructor(public readonly tokens: Token[]) { }

    /**
     * Removes and returns the next token.
     * 
     * @param expectedType The expected type of the next token. If it does not match, a {@link TokenError} is thrown.
     * @param expectedValue The expected value of the next token. If it does not match, a {@link TokenError} is thrown.
     * 
     * @return The removed token.
     */
    private next(expectedType?: keyof typeof tokenTypes, expectedValue?: string): Token {
        if (expectedType && this.tokens[0].type !== expectedType) throw new TokenError(this.tokens[0], `Expected type ${expectedType} but found ${this.tokens[0].type}`);
        if (expectedValue && this.tokens[0].value !== expectedValue) throw new TokenError(this.tokens[0], `Expected ${expectedValue} but found ${this.tokens[0].value}`);

        // If the next token is a right brace, exit the current scope and return the current scope to the parent.
        if (this.nextIs("right brace")) this.currentScope = this.currentScope.parent!;

        // If the next token is a left brace, enter a new scope with the old scope as the parent.
        else if (this.nextIs("left brace")) this.currentScope = new Scope(this.currentScope);

        return this.tokens.shift()!;
    }

    /**
     * Checks if the next token matches the given type and value if given without removing it.
     * 
     * @param expectedType The type of token to expect
     * @param expectedValue The value to expect
     * 
     * @return whether or not the next token matches the given type and value if given.
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
     * @return whether or not the token after the next one matches the given type and value if given.
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
     * @return The parsed node.
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
     * @return The parsed node.
     * 
     * @see `<fun-decl>`: {@link parseFunctionDeclaration FunctionDeclaration}
     */
    private parseFunctionList(): ASTNode {
        let node: ASTNode & { next?: ASTNode } = this.parseFunctionDeclaration();
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
     * @return The parsed node.
     * @see `<id-list>`: {@link parseIdentifierList IdentifierList}
     */
    private parseFunctionDeclaration(): ASTNode {
        this.next("keyword", "fun");
        let name = this.next("identifier").value;

        this.next("left parentheses");
        let args: ASTNode | null = null;
        if (!this.nextIs("right parentheses")) args = this.parseIdentifierList();

        this.next("right parentheses");
        this.next("left brace");
        this.next("newline");

        let body: ASTNode & { varList?: ASTNode, statementList?: ASTNode } = { type: "function body" };
        if (this.nextIs("keyword", "var")) body.varList = this.parseVarList();
        if (!(this.nextIs("right brace") || (this.nextIs("newline") && this.nextNextIs("right brace")))) body.statementList = this.parseStatementList();

        let node: ASTNode & { name: string, body: ASTNode, arguments?: ASTNode } = {
            type: "function declaration",
            name: name,
            body: body
        };

        if (args) node.arguments = args;
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
     * @return The parsed node.
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
     * @return The parsed node.
     * 
     * @see `<id-list>`: {@link parseIdentifierList IdentifierList}
     */
    private parseVarList(previousNode?: ASTNode): ASTNode {
        let node: ASTNode & { idList?: IdListNode, next?: ASTNode } = { type: "var list" };
        this.next("keyword", "var");
        node.idList = this.parseIdentifierList();
        this.next("newline");
        if (this.nextIs("keyword", "var")) node.next = this.parseVarList(node);

        // Only check variables if the node is complete, ie., all sub-nodes are generated and no sub-nodes call this
        if (!previousNode) {
            let variables: { name: string, token: Token }[] = [];
            let searchingNode = node;
            while (searchingNode) {
                let id = searchingNode.idList!;
                while (id) {
                    variables.push({ name: id.value, token: id.token });
                    id = id.next!;
                }
                searchingNode = searchingNode.next!;
            }

            // Add the variables to the current scope
            variables.forEach(variable => {
                if (this.currentScope.hasVariableWithName(variable.name)) throw new TokenError(variable.token, `Duplicate identifier "${variable.name}"`);
                this.currentScope.variables.push({ name: variable.name, token: variable.token });
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
     * @return The parsed node.
     * @see `<stmt>`: {@link parseStatement Statement}
     */
    private parseStatementList(): ASTNode {
        let node: ASTNode & { next?: ASTNode, statement?: ASTNode } = { type: "statement list" };
        if (this.nextIs("newline")) {
            this.next("newline");
            node.next = this.parseStatementList();
            return node;
        }
        node.statement = this.parseStatement();
        return node;
    }

    /**
     * Parses a statemenet;
     * 
     * Syntax:
     * 
     * ```tranquility
     * <stmt> ::= 
     *      <expr> ":" <expr> "\n" |
     *      <expr> "\n" |
     *      <if-stmt> |
     *      "until" <expr> "\n" |
     *      "loop" "{" "\n" <stmt-list> "}" "\n" |
     *      "return" "\n" |
     *      "return" <expr> "\n"
     * ```
     * 
     * @return The parsed node.
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
            node.expression = this.parseExpression();
            this.next("newline");
        }

        // Loop statement
        if (this.nextIs("keyword", "loop")) {
            let node: ASTNode & { body?: ASTNode } = { type: "loop" };
            this.next("keyword", "loop");
            this.next("left brace");
            this.next("newline");
            node.body = this.parseStatementList();
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

        throw new TokenError(this.tokens[0], `Unexpected token: ${this.next().value}`);
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
     * @return The parsed node.
     * @see `<bcexpr>`: {@link parseBitwiseComparisonExpression BitwiseComparisonExpression}
     */
    private parseBinaryExpression(): ASTNode {
        let left = this.parseBitwiseComparisonExpression();
        if (this.nextIs("xor")) {
            let operation = this.parseLiteral().token;
            let right = this.parseBitwiseComparisonExpression();
            let node: ASTNode & { left: ASTNode, operation: Token, right: ASTNode } = {
                type: "binary expression",
                left: left,
                operation: operation,
                right: right
            };
            return node;
        }
        return left;
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
     * @return The parsed node.
     * @see `<cexpr>`: {@link parseComparisonExpression ComparisonExpression}
     */
    private parseBitwiseComparisonExpression(): ASTNode {
        let left = this.parseComparisonExpression();
        if (this.nextIs("bitwise comparison")) {
            let operation = this.parseLiteral().token;
            let right = this.parseComparisonExpression();
            let node: ASTNode & { left: ASTNode, operation: Token, right: ASTNode } = {
                type: "binary expression",
                left: left,
                operation: operation,
                right: right
            };
            return node;
        }
        return left;
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
     * @return The parsed node.
     * @see `<bsexpr>`: {@link parseBitwiseShiftExpression BitwiseShiftExpression}
     */
    private parseComparisonExpression(): ASTNode {
        let left = this.parseBitwiseShiftExpression();
        if (this.nextIs("comparison")) {
            let operation = this.parseLiteral().token;
            let right = this.parseBitwiseShiftExpression();
            let node: ASTNode & { left: ASTNode, operation: Token, right: ASTNode } = {
                type: "binary expression",
                left: left,
                operation: operation,
                right: right
            };
            return node;
        }
        return left;
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
     * @return The parsed node.
     * @see `<aexpr>`: {@link parseAdditiveExpression AdditiveExpression}
     */
    private parseBitwiseShiftExpression(): ASTNode {
        let left = this.parseAdditiveExpression();
        if (this.nextIs("bitwise shift")) {
            let operation = this.parseLiteral().token;
            let right = this.parseAdditiveExpression();
            let node: ASTNode & { left: ASTNode, operation: Token, right: ASTNode } = {
                type: "binary expression",
                left: left,
                operation: operation,
                right: right
            };
            return node;
        }
        return left;
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
     * @return The parsed node.
     * @see `<mexpr>`: {@link parseMultiplicativeExpression MultiplicativeExpression}
     */
    private parseAdditiveExpression(): ASTNode {
        let left = this.parseMultiplicativeExpression();
        if (this.nextIs("additive")) {
            let operation = this.parseLiteral().token;
            let right = this.parseMultiplicativeExpression();
            let node: ASTNode & { left: ASTNode, operation: Token, right: ASTNode } = {
                type: "binary expression",
                left: left,
                operation: operation,
                right: right
            };
            return node;
        }
        return left;
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
     * @return The parsed node.
     * @see `<uexpr>`: {@link parseUnaryExpression UnaryExpression}
     */
    private parseMultiplicativeExpression(): ASTNode {
        let left = this.parseUnaryExpression();
        if (this.nextIs("multiplicative")) {
            let operation = this.parseLiteral().token;
            let right = this.parseUnaryExpression();
            let node: ASTNode & { left: ASTNode, operation: Token, right: ASTNode } = {
                type: "binary expression",
                left: left,
                operation: operation,
                right: right
            };
            return node;
        }
        return left;
    }

    /** 
     * Parses an expression.
     * @return The parsed node.
     */
    private parseExpression(): ASTNode {
        return this.parseBinaryExpression();
    }

    /**
     * Parses a unary expression. Contrary to its name, this parses more than just unary expressions, specifically:
     * - Unary operations: `-<expr>, ~<expr>, .<expr>`
     * - Literals: `<integer>, <string>, <character>, <identifier>`
     * - Function calls: `<identifier>(<arguments>)`
     * - Parenthesized expressions: `(<expr>)`
     * 
     * @return The parsed node
     */
    private parseUnaryExpression(): ASTNode {

        // Function call
        if (this.nextIs("identifier") && this.nextNextIs("left parentheses")) {
            let literal = this.parseLiteral();
            this.next("left parentheses");
            let node: ASTNode & { name?: string, arguments?: ASTNode } = { type: "function call" };
            node.name = literal.value;
            node.arguments = this.parseExpressionList();
            this.next("right parentheses");
            return node;
        }

        // Literal Expression
        if (this.nextIs("integer") || this.nextIs("character") || this.nextIs("string")) {
            return this.parseLiteral();
        }

        // Identifier
        if (this.nextIs("identifier")) {
            let identifier = this.parseLiteral();
            if (!this.currentScope.hasVariableWithName(identifier.value)) throw new TokenError(identifier.token, `Variable "${identifier.value}" is not defined.`);
            return identifier;
        }

        // Parenthesized expression
        if (this.nextIs("left parentheses")) {
            this.next("left parentheses");
            let node: ASTNode & { expressionList?: ASTNode } = { type: "expression" };
            if (!this.nextIs("right parentheses")) node.expressionList = this.parseExpressionList();
            this.next("right parentheses");
            return node;
        }

        // Dereferencing
        if (this.nextIs("dot")) {
            let node: ASTNode & { operation?: string, expression?: ASTNode } = { type: "unary operation expression" };
            node.operation = this.next("dot").value;
            node.expression = this.parseExpression();
            return node;
        }

        // Unary negation
        if (this.nextIs("minus")) {
            let node: ASTNode & { expression?: ASTNode } = { type: "negation" };
            this.next("minus");
            node.expression = this.parseExpression();
        }

        // Bitwise negation
        if (this.nextIs("bitwise not")) {
            let node: ASTNode & { expression?: ASTNode } = { type: "bitwise negation" };
            this.next("bitwise not");
            node.expression = this.parseExpression();
        }

        throw new TokenError(this.tokens[0], `Unexpected token: ${this.next().value}`);
    }

    private parseLiteral(): ASTNode & { value: string, token: Token } {
        let next = this.next();
        return { type: next.type, value: next.value, token: next };
    }

    private parseExpressionList(): ASTNode {
        let expression: ASTNode & { next?: ASTNode } = this.parseExpression();
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
        this.next("left brace");
        this.next("newline");
        node.body = this.parseStatementList();
        this.next("right brace");
        this.next("newline");

        if (this.nextIs("keyword", "else")) {
            if (this.nextIs("keyword", "if")) node.elseBody = this.parseIfStatement();
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