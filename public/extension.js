"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = void 0;
const vscode = require("vscode");
const diagnostics_1 = require("./diagnostics");
const builtins_1 = require("./builtins");
function activate(context) {
    let tranqDiagnostics = vscode.languages.createDiagnosticCollection("tranquility");
    context.subscriptions.push(tranqDiagnostics);
    (0, diagnostics_1.subscribeToDocumentChanges)(context, tranqDiagnostics);
    vscode.languages.registerHoverProvider("tranquility", {
        provideHover(document, position, token) {
            let range = document.getWordRangeAtPosition(position);
            let word = document.getText(range);
            let builtinFunction = builtins_1.builtInFunctions.find(func => func.name === word);
            if (builtinFunction)
                return { contents: [builtinFunction.description] };
            return null;
        }
    });
}
exports.activate = activate;
