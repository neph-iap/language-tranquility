import * as vscode from "vscode";
import { subscribeToDocumentChanges } from "./diagnostics";
import { allHoverDescriptions } from "./documentation";

export function activate(context: vscode.ExtensionContext): void {

    let tranqDiagnostics = vscode.languages.createDiagnosticCollection("tranquility");
    context.subscriptions.push(tranqDiagnostics);
    subscribeToDocumentChanges(context, tranqDiagnostics);

    vscode.languages.registerHoverProvider("tranquility", {
        provideHover(document, position, token) {
            let range = document.getWordRangeAtPosition(position);
            let word = document.getText(range);

            if (Object.keys(allHoverDescriptions).includes(word)) return { contents: [allHoverDescriptions[word]] };
            return null;
        }
    });
}
