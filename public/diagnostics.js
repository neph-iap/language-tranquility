"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.subscribeToDocumentChanges = exports.refreshDiagnostics = void 0;
const vscode = require("vscode");
const cmd = require("child_process");
function refreshDiagnostics(doc, tranqDiagnostics) {
    if (!/.t(ranq)?$/i.test(doc.uri.path))
        return;
    createDiagnostic(doc, tranqDiagnostics);
}
exports.refreshDiagnostics = refreshDiagnostics;
function createDiagnostic(doc, tranqDiagnostics) {
    let diagnostics = [];
    function onData(data) {
        let regex = /\:(\d+)\:/;
        let match = data.match(regex);
        if (match) {
            let unresolved = /unresolved\ssymbol\s(.+)$/;
            let unresolvedMatch = data.match(unresolved);
            if (unresolvedMatch) {
                let lineNumber = Number(match[1]);
                let line = doc.lineAt(lineNumber);
                let index = line.text.indexOf(unresolvedMatch[1]);
                let range = new vscode.Range(lineNumber, index, lineNumber, index + unresolvedMatch[1].length);
                let diagnostic = new vscode.Diagnostic(range, "Test error", vscode.DiagnosticSeverity.Error);
                diagnostic.code = data;
                diagnostics.push(diagnostic);
            }
        }
    }
    let process = cmd.execFile("~/home/bls96/tranquility/tranqc", [doc.uri.path]);
    process.stdout.setEncoding('utf8');
    process.stdout.on('data', onData);
    process.stderr.setEncoding('utf8');
    process.stderr.on('data', onData);
    process.on("close", () => { tranqDiagnostics.set(doc.uri, diagnostics); });
}
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
