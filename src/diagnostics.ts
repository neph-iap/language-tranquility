import * as vscode from "vscode";
import tokenize, { getVariableNames, Token } from "./lexer";
import Parser, { TokenError } from "./parser";

export function refreshDiagnostics(doc: vscode.TextDocument, tranqDiagnostics: vscode.DiagnosticCollection): void {
    if (!/.t(ranq)?$/i.test(doc.uri.path)) return;
    
    let diagnostics: vscode.Diagnostic[] = [];
    
    try {
        let tokens = tokenize(doc.getText());
        tokens.forEach(token => console.log(token.type.name, token.value));

        let variables = getVariableNames(tokens);
        let keys = Object.keys(variables);
        tokens.filter(token => token.type.name === "identifier").forEach(token => {
            if (!keys.includes(token.value)) createTokenDiagnostic(diagnostics, token, `Error: ${token.value} is not defined.`, vscode.DiagnosticSeverity.Error);
        });

        new Parser(tokens).parse();
    } catch(error) {
        if (error instanceof TokenError) createTokenDiagnostic(diagnostics, error.token, error.message, error.severity);
        else console.log(error);
    }

    console.log(JSON.stringify(diagnostics));
    tranqDiagnostics.set(doc.uri, diagnostics);
}

export function createTokenDiagnostic(diagnostics: vscode.Diagnostic[], token: Token, message: string, severity: vscode.DiagnosticSeverity = vscode.DiagnosticSeverity.Error): void {
    let range = new vscode.Range(token.line, token.column, token.line, token.column + token.value.length);
    let diagnostic = new vscode.Diagnostic(range, message, severity);
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