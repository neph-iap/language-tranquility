"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.subscribeToDocumentChanges = exports.createTokenDiagnostic = exports.refreshDiagnostics = void 0;
const vscode = require("vscode");
const documentation_1 = require("./documentation");
const lexer_1 = require("./lexer");
const parser_1 = require("./parser");
function refreshDiagnostics(doc, tranqDiagnostics) {
    if (!/.t(ranq)?$/i.test(doc.uri.path))
        return;
    let diagnostics = [];
    try {
        let tokens = (0, lexer_1.default)(doc.getText());
        let variables = getVariableNames(tokens, diagnostics);
        let keys = Object.keys(variables);
        tokens.filter(token => token.type.name === "identifier").forEach(token => {
            if (!keys.includes(token.value))
                createTokenDiagnostic(diagnostics, token, `${token.value} is not defined.`, vscode.DiagnosticSeverity.Error);
        });
        let counts = new Map();
        tokens.filter(token => token.type.name === "identifier").forEach(token => {
            counts.set(token.value, { token: token, count: counts.has(token.value) ? counts.get(token.value).count + 1 : 1 });
        });
        let builtins = Object.keys(documentation_1.functionDescriptions);
        for (let [variableName, countObject] of counts) {
            if (countObject.count === 1 && !builtins.includes(variableName))
                createTokenDiagnostic(diagnostics, countObject.token, `Variable "${variableName}" is unused.`, vscode.DiagnosticSeverity.Warning);
        }
        for (let i = 0; i < tokens.length; i++) {
            let token = tokens[i];
            if (token.type.name === "unrecognized") {
                if (/^;+$/.test(token.value))
                    createTokenDiagnostic(diagnostics, token, `Semicolons are not allowed in Tranquility. Simply end statements with a new line.`, vscode.DiagnosticSeverity.Error);
                else if (/^\r+$/.test(token.value))
                    createTokenDiagnostic(diagnostics, token, `Carriage returns are not allowed in Tranquility. Read the README to learn how to remove them.`, vscode.DiagnosticSeverity.Error);
                else
                    createTokenDiagnostic(diagnostics, token, `Unrecognized token "${token.value}"`, vscode.DiagnosticSeverity.Error);
            }
        }
        new parser_1.default(tokens).parse();
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
function getVariableNames(tokens, diagnostics) {
    let variableNames = {};
    Object.keys(documentation_1.functionDescriptions).forEach(func => variableNames[func] = "fun");
    for (let i = 0; i < tokens.length; i++) {
        let token = tokens[i];
        let nextToken = tokens[i + 1];
        if (token.type.name === "keyword") {
            if (token.value === "var") {
                if (Object.keys(variableNames).includes(nextToken.value))
                    createTokenDiagnostic(diagnostics, nextToken, `Variable "${nextToken.value}" already exists. To reassign it, use \`${nextToken.value} : <value>\`"`, vscode.DiagnosticSeverity.Error);
                variableNames[nextToken.value] = "var";
            }
            else if (token.value === "fun") {
                if (Object.keys(documentation_1.functionDescriptions).includes(nextToken.value) && nextToken.value !== "init")
                    createTokenDiagnostic(diagnostics, nextToken, `Error: function ${nextToken.value} already exists as a built-in function. Choose a different function name."`, vscode.DiagnosticSeverity.Error);
                else if (Object.keys(variableNames).includes(nextToken.value) && nextToken.value !== "init")
                    createTokenDiagnostic(diagnostics, nextToken, `Function ${nextToken.value} already exists. Either rename the duplicate or choose a different name for this function."`, vscode.DiagnosticSeverity.Error);
                variableNames[nextToken.value] = "fun";
            }
        }
    }
    return variableNames;
}
