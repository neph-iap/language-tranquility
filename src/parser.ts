import * as vscode from "vscode";
import { Token } from "./lexer";

interface ASTNode {
    type: string;
    [key: string | number]: any;
}

export class TokenError extends Error {
    constructor(public readonly token: Token, message: string, public readonly severity: vscode.DiagnosticSeverity = vscode.DiagnosticSeverity.Error) {
        super(message);
    }
}

export default class Parser {

    public constructor(public readonly tokens: Token[]) {}

    private next(expectedType?: string, expectedValue?: string): Token {
        if (expectedType && this.tokens[0].type.name !== expectedType) throw new TokenError(this.tokens[0], `Expected type ${expectedType} but found ${this.tokens[0].type.name}`);
        if (expectedValue && this.tokens[0].value !== expectedValue) throw new TokenError(this.tokens[0], `Expected ${expectedValue} but found ${this.tokens[0].value}`);
        return this.tokens.shift()!;
    }

    private nextIs(expectedType: string, expectedValue?: string): boolean {
        if (!expectedValue) return this.tokens[0].type.name === expectedType;
        return this.tokens[0].type.name === expectedType && this.tokens[0].value === expectedValue;
    }

    parse(): ASTNode {
        let node: ASTNode = { type: "program" };
        if (this.nextIs("keyword", "var")) node.varList = this.parseVarList();
        if (this.nextIs("keyword", "fun")) node.funList = this.parseFunctionList();
        return node;
    }

    private parseFunctionList(): ASTNode {
        let node = this.parseFunctionDeclaration();
        if (this.nextIs("keyword", "fun")) node.nextFunction = this.parseFunctionDeclaration();
        return node;
    }

    private parseFunctionDeclaration(): ASTNode {
        this.next("keyword", "fun");
        let name = this.next("identifier");

        this.next("left parentheses");
        let args: ASTNode | null = null;
        if (!this.nextIs("right parentheses")) args = this.parseIdentifierList();

        this.next("right parentheses");
        this.next("left brace");
        this.next("newline");

        let body: ASTNode = { type: "function body" };
        if (this.nextIs("keyword", "var")) body.varList = this.parseVarList();
        if (this.nextIs("")) body.statementlist = this.parseStatementList();

        let node: ASTNode = {
            type: "function declaration",
            name: name,
            body: body
        };

        if (args) node.arguments = args;
        return node;
    }

    private parseIdentifierList(): ASTNode {
        let identifiers: ASTNode = { type: "identifier list" };
        identifiers.value = this.next("identifier");
        if (this.nextIs("comma")) {
            this.next("comma");
            identifiers.nextIdentifier = this.parseIdentifierList();
        }
        return identifiers;
    }

    private parseVarList(): ASTNode {
        let node = { type: "var list"};
        this.next("keyword", "var");
        node["identifier list"] = this.parseIdentifierList();
        this.next("newline");
        if (this.nextIs("keyword", "var")) node["sub var list"] = this.parseVarList();
        return node;
    }

    private parseStatementList(): ASTNode {
        let node: ASTNode = { type: "statement list" };
        if (this.nextIs("newline")) {
            this.next("newline");
            node.nextStatement = this.parseStatementList();
            return node;
        }
        node.statement = this.parseStatement();
        return node;
    }

    private parseStatement(): ASTNode {
        if (this.nextIs("keyword", "if")) return this.parseIfStatement();
        
        if (this.nextIs("keyword", "until")) {
            let node: ASTNode = { type: "until statement" };
            this.next("keyword", "until");
            node.expression = this.parseExpression();
            this.next("newline");
        }

        if (this.nextIs("keyword", "loop")) {
            let node: ASTNode = { type: "loop" };
            this.next("keyword", "loop");
            this.next("left brace");
            this.next("newline");
            node.body = this.parseStatementList();
            this.next("right brace");
            this.next("newline");
            return node;
        }

        if (this.nextIs("return")) {
            let node: ASTNode = { type: "return statement"};
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
            let node: ASTNode = { type: "assignment" };
            node.expression1 = expression;
            node.expression2 = this.parseExpression();
            this.next("newline");
            return node;
        }

        if (this.nextIs("newline")) {
            let node: ASTNode = { type: "expression statement" };
            node.expression = expression;
            this.next("newline");
            return node;
        }

        throw new TokenError(this.tokens[0], `Unexpected token: ${this.next().value}`);
    }

    private parseExpression(): ASTNode {
        if (this.nextIs("integer") || this.nextIs("character") || this.nextIs("string")) {
            return this.parseLiteral(); // TODO: binary expressions
        }

        if (this.nextIs("identifier")) {
            let identifier = this.next("identifier");
            if (this.nextIs("left parentheses")) {
                this.next("left parentheses");
                let node: ASTNode = { type: "function call" };
                node.name = identifier;
                node.arguments = this.parseExpressionList();
                this.next("right parenthses");
                return node;
            }

            return { type: "identifier", value: identifier.value};
        }
        
        if (this.nextIs("left parentheses")) {
            this.next("left parentheses");
            let node: ASTNode = { type: "expression" };
            if (!this.nextIs("right parentheses")) {
                node.expressionList = this.parseExpressionList();
            }
            this.next("right parentheses");
            return node;
        }

        if (this.nextIs("dot")) {
            let node: ASTNode = { type: "unary operation expression" };
            node.operation = this.next("dot");
            node.expression = this.parseExpression();
            return node;
        }

        if (this.nextIs("minus")) {
            let node: ASTNode = { type: "negation" };
            this.next("minus");
            node.expression = this.parseExpression();
        }

        if (this.nextIs("bitwise not")) {
            let node: ASTNode = { type: "bitwise negation" };
            this.next("bitwise not");
            node.expression = this.parseExpression();
        }

        throw new TokenError(this.tokens[0], `Unexpected token: ${this.next().value}`);
    }

    private parseLiteral(): ASTNode {
        return { type: this.next().type.name, value: this.next().value };
    }

    private parseExpressionList(): ASTNode {
        let expression = this.parseExpression();
        if (this.nextIs("comma")) {
            this.next("comma");
            expression.nextExpression = this.parseExpression();
        }
        return expression;
    }

    private parseIfStatement(): ASTNode {
        let node: ASTNode = { type: "if statement"};
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