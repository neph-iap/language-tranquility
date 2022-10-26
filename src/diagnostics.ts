import * as vscode from "vscode";
import { functionDescriptions } from "./documentation";
import tokenize, { Token } from "./lexer";
import Parser, { TokenError } from "./parser";

export function refreshDiagnostics(doc: vscode.TextDocument, tranqDiagnostics: vscode.DiagnosticCollection): void {
    if (!/.t(ranq)?$/i.test(doc.uri.path)) return;

    let diagnostics: vscode.Diagnostic[] = [];

    try {
        // Tokenize the code
        let tokens = tokenize(doc.getText());

        // Error unrecognized identifiers
        let variables = getVariableNames(tokens, diagnostics);
        let keys = Object.keys(variables);
        tokens.filter(token => token.type.name === "identifier").forEach(token => {
            if (!keys.includes(token.value)) createTokenDiagnostic(diagnostics, token, `${token.value} is not defined.`, vscode.DiagnosticSeverity.Error);
        });

        // Warn unused variables
        let counts = new Map<string, { token: Token, count: number }>();
        tokens.filter(token => token.type.name === "identifier").forEach(token => {
            counts.set(token.value, { token: token, count: counts.has(token.value) ? counts.get(token.value)!.count + 1 : 1 });
        });
        let builtins = Object.keys(functionDescriptions);
        for (let [variableName, countObject] of counts) {
            if (countObject.count === 1 && !builtins.includes(variableName)) createTokenDiagnostic(diagnostics, countObject.token, `Variable "${variableName}" is unused.`, vscode.DiagnosticSeverity.Warning);
        }

        // Error unrecognized tokens
        for (let i = 0; i < tokens.length; i++) {
            let token = tokens[i];
            if (token.type.name === "unrecognized") {
                if (/^;+$/.test(token.value)) createTokenDiagnostic(diagnostics, token, `Semicolons are not allowed in Tranquility. Simply end statements with a new line.`, vscode.DiagnosticSeverity.Error);
                else if (/^\r+$/.test(token.value)) createTokenDiagnostic(diagnostics, token, `Carriage returns are not allowed in Tranquility. Read the README to learn how to remove them.`, vscode.DiagnosticSeverity.Error);
                else createTokenDiagnostic(diagnostics, token, `Unrecognized token "${token.value}"`, vscode.DiagnosticSeverity.Error);
            }
        }

        // Check for parsing errors
        new Parser(tokens).parse();
    }

    catch (error) {
        // Handle token errors as diagnostics
        if (error instanceof TokenError) createTokenDiagnostic(diagnostics, error.token, error.message, error.severity);
        else console.log(error);
    }

    tranqDiagnostics.set(doc.uri, diagnostics);
}

export function createTokenDiagnostic(diagnostics: vscode.Diagnostic[], token: Token, message: string, severity: vscode.DiagnosticSeverity = vscode.DiagnosticSeverity.Error): void {
    let start: string;
    switch (severity) {
        case vscode.DiagnosticSeverity.Error: start = "❌ Error: "; break;
        case vscode.DiagnosticSeverity.Warning: start = "⚠️ Warning: "; break;
        case vscode.DiagnosticSeverity.Information: start = "🔵 Info: "; break;
        case vscode.DiagnosticSeverity.Hint: start = "❔ Hint: "; break;
    }
    let range = new vscode.Range(token.line, token.column, token.line, token.column + token.value.length);
    let diagnostic = new vscode.Diagnostic(range, `${start!}${message}`, severity);
    diagnostics.push(diagnostic);
}

export function subscribeToDocumentChanges(context: vscode.ExtensionContext, tranqDiagnostics: vscode.DiagnosticCollection): void {
    if (vscode.window.activeTextEditor) refreshDiagnostics(vscode.window.activeTextEditor.document, tranqDiagnostics);
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(editor => {
            if (editor) refreshDiagnostics(editor.document, tranqDiagnostics);
        })
    );
    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument(editor => {
            refreshDiagnostics(editor.document, tranqDiagnostics);
        })
    );
    context.subscriptions.push(
        vscode.workspace.onDidCloseTextDocument(document => {
            tranqDiagnostics.delete(document.uri);
        })
    );
}

function getVariableNames(tokens: Token[], diagnostics: vscode.Diagnostic[]) {
    let variableNames: { [key: string]: { type: "var" | "fun", isAssigned: boolean } } = {};
    Object.keys(functionDescriptions).forEach(func => variableNames[func] = { type: "fun", isAssigned: true });
    for (let i = 0; i < tokens.length; i++) {
        let token = tokens[i];
        let nextToken = tokens[i + 1];
        let lastToken = tokens[i - 1];

        if (token.type.name === "keyword") {
            if (token.value === "var") {
                if (Object.keys(variableNames).includes(nextToken.value)) createTokenDiagnostic(diagnostics, nextToken, `Variable "${nextToken.value}" already exists. To reassign it, use \`${nextToken.value} : <value>\``, vscode.DiagnosticSeverity.Error);
                variableNames[nextToken.value] = { type: "var", isAssigned: false };
            }
            else if (token.value === "fun") {
                if (Object.keys(functionDescriptions).includes(nextToken.value) && nextToken.value !== "init") createTokenDiagnostic(diagnostics, nextToken, `Error: function ${nextToken.value} already exists as a built-in function. Choose a different function name.`, vscode.DiagnosticSeverity.Error);
                else if (Object.keys(variableNames).includes(nextToken.value) && nextToken.value !== "init") createTokenDiagnostic(diagnostics, nextToken, `Function ${nextToken.value} already exists. Either rename the duplicate or choose a different name for this function.`, vscode.DiagnosticSeverity.Error);
                variableNames[nextToken.value] = { type: "fun", isAssigned: true };
            }
        }

        else if (token.type.name === "identifier" && nextToken?.type.name === "colon") {
            variableNames[token.value].isAssigned = true;
        }

        else if (token.type.name === "identifier" && !(lastToken?.type.name === "keyword" && lastToken?.value === "var")) {
            if (!variableNames[token.value].isAssigned) createTokenDiagnostic(diagnostics, token, `No value has been assigned to the memory location "${token.value}". To assign it, use \n\`${token.value} : <expr>\``, vscode.DiagnosticSeverity.Error);
        }
    }
    return variableNames;
}