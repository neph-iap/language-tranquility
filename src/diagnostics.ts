import * as vscode from "vscode";
import tokenize, { Token } from "./lexer";
import Parser, { TokenError } from "./parser";

export function refreshDiagnostics(doc: vscode.TextDocument, tranqDiagnostics: vscode.DiagnosticCollection): void {
    if (!/.t(ranq)?$/i.test(doc.uri.path)) return;

    let diagnostics: vscode.Diagnostic[] = [];

    try {
        // Tokenize the code
        let tokens = tokenize(doc.getText());

        // Error unrecognized tokens
        for (let i = 0; i < tokens.length; i++) {
            let token = tokens[i];
            if (token.type === "unrecognized") {
                if (/^;+$/.test(token.value)) createTokenDiagnostic(diagnostics, token, `Semicolons are not allowed in Tranquility. Simply end statements with a new line.`, vscode.DiagnosticSeverity.Error);
                else if (/^\r+$/.test(token.value)) createTokenDiagnostic(diagnostics, token, `Carriage returns are not allowed in Tranquility. Read the README to learn how to remove them.`, vscode.DiagnosticSeverity.Error);
                else if (/^=$/.test(token.value)) createTokenDiagnostic(diagnostics, token, "Equal signs are not used in Tranquility. To store a value into a memory address, use <address> \":\" <value>", vscode.DiagnosticSeverity.Error);
                else createTokenDiagnostic(diagnostics, token, `Unrecognized token "${token.value}"`, vscode.DiagnosticSeverity.Error);
            }
        }

        // Check for parsing errors
        let AST = new Parser(tokens, diagnostics).parse();
        console.log(AST);
    }

    catch (error) {
        // Handle token errors as diagnostics
        if (error instanceof TokenError) createTokenDiagnostic(diagnostics, error.token, error.message, error.severity);
        else console.log(error);
    }

    tranqDiagnostics.set(doc.uri, diagnostics);
}

export function createTokenDiagnostic(diagnostics: vscode.Diagnostic[], token: Token, message: string, severity: vscode.DiagnosticSeverity = vscode.DiagnosticSeverity.Error): void {
    if (token.hasDiagnostic) return;
    let start: string;
    switch (severity) {
        case vscode.DiagnosticSeverity.Error: start = "❌ Error: "; break;
        case vscode.DiagnosticSeverity.Warning: start = "⚠️ Warning: "; break;
        case vscode.DiagnosticSeverity.Information: start = "🔵 Info: "; break;
        case vscode.DiagnosticSeverity.Hint: start = "❔ Hint: "; break;
    }
    let range = new vscode.Range(token.line, token.column, token.line, token.column + token.value.length);
    let diagnostic = new vscode.Diagnostic(range, start! + message, severity);
    token.hasDiagnostic = true;
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

export function tokenNonError(diagnostics: vscode.Diagnostic[], token: Token, message: string, severity: vscode.DiagnosticSeverity) {
    createTokenDiagnostic(diagnostics, token, message, severity);
}