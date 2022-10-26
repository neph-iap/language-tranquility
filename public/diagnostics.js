"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.subscribeToDocumentChanges = exports.createTokenDiagnostic = exports.refreshDiagnostics = void 0;
const vscode = require("vscode");
const lexer_1 = require("./lexer");
const parser_1 = require("./parser");
function refreshDiagnostics(doc, tranqDiagnostics) {
    if (!/.t(ranq)?$/i.test(doc.uri.path))
        return;
    let diagnostics = [];
    try {
        let tokens = (0, lexer_1.default)(doc.getText());
        for (let i = 0; i < tokens.length; i++) {
            let token = tokens[i];
            if (token.type === "unrecognized") {
                if (/^;+$/.test(token.value))
                    createTokenDiagnostic(diagnostics, token, `Semicolons are not allowed in Tranquility. Simply end statements with a new line.`, vscode.DiagnosticSeverity.Error);
                else if (/^\r+$/.test(token.value))
                    createTokenDiagnostic(diagnostics, token, `Carriage returns are not allowed in Tranquility. Read the README to learn how to remove them.`, vscode.DiagnosticSeverity.Error);
                else
                    createTokenDiagnostic(diagnostics, token, `Unrecognized token "${token.value}"`, vscode.DiagnosticSeverity.Error);
            }
        }
        let AST = new parser_1.default(tokens).parse();
        console.log(AST);
    }
    catch (error) {
        if (error instanceof parser_1.TokenError)
            createTokenDiagnostic(diagnostics, error.token, error.message, error.severity);
        else
            console.log(error);
    }
    tranqDiagnostics.set(doc.uri, diagnostics);
}
exports.refreshDiagnostics = refreshDiagnostics;
function createTokenDiagnostic(diagnostics, token, message, severity = vscode.DiagnosticSeverity.Error) {
    let start;
    switch (severity) {
        case vscode.DiagnosticSeverity.Error:
            start = "❌ Error: ";
            break;
        case vscode.DiagnosticSeverity.Warning:
            start = "⚠️ Warning: ";
            break;
        case vscode.DiagnosticSeverity.Information:
            start = "🔵 Info: ";
            break;
        case vscode.DiagnosticSeverity.Hint:
            start = "❔ Hint: ";
            break;
    }
    let range = new vscode.Range(token.line, token.column, token.line, token.column + token.value.length);
    let diagnostic = new vscode.Diagnostic(range, `${start}${message}`, severity);
    diagnostics.push(diagnostic);
}
exports.createTokenDiagnostic = createTokenDiagnostic;
function subscribeToDocumentChanges(context, tranqDiagnostics) {
    if (vscode.window.activeTextEditor)
        refreshDiagnostics(vscode.window.activeTextEditor.document, tranqDiagnostics);
    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor)
            refreshDiagnostics(editor.document, tranqDiagnostics);
    }));
    context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(editor => {
        refreshDiagnostics(editor.document, tranqDiagnostics);
    }));
    context.subscriptions.push(vscode.workspace.onDidCloseTextDocument(document => {
        tranqDiagnostics.delete(document.uri);
    }));
}
exports.subscribeToDocumentChanges = subscribeToDocumentChanges;
