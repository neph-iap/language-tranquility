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
        tokens.forEach(token => console.log(token.type.name, token.value));
        let variables = (0, lexer_1.getVariableNames)(tokens);
        let keys = Object.keys(variables);
        tokens.filter(token => token.type.name === "identifier").forEach(token => {
            if (!keys.includes(token.value))
                createTokenDiagnostic(diagnostics, token, `Error: ${token.value} is not defined.`, vscode.DiagnosticSeverity.Error);
        });
        new parser_1.default(tokens).parse();
    }
    catch (error) {
        if (error instanceof parser_1.TokenError)
            createTokenDiagnostic(diagnostics, error.token, error.message, error.severity);
        else
            console.log(error);
    }
    console.log(JSON.stringify(diagnostics));
    tranqDiagnostics.set(doc.uri, diagnostics);
}
exports.refreshDiagnostics = refreshDiagnostics;
function createTokenDiagnostic(diagnostics, token, message, severity = vscode.DiagnosticSeverity.Error) {
    let range = new vscode.Range(token.line, token.column, token.line, token.column + token.value.length);
    let diagnostic = new vscode.Diagnostic(range, message, severity);
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
