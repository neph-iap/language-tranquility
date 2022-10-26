"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = void 0;
const vscode = require("vscode");
const diagnostics_1 = require("./diagnostics");
const documentation_1 = require("./documentation");
function activate(context) {
    let tranqDiagnostics = vscode.languages.createDiagnosticCollection("tranquility");
    context.subscriptions.push(tranqDiagnostics);
    (0, diagnostics_1.subscribeToDocumentChanges)(context, tranqDiagnostics);
    vscode.languages.registerHoverProvider("tranquility", {
        provideHover(document, position, token) {
            let range = document.getWordRangeAtPosition(position);
            let word = document.getText(range);
            if (Object.keys(documentation_1.allHoverDescriptions).includes(word))
                return { contents: [documentation_1.allHoverDescriptions[word]] };
            return null;
        }
    });
}
exports.activate = activate;
