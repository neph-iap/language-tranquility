import * as vscode from "vscode";
import { subscribeToDocumentChanges } from "./diagnostics";
import { builtInFunctions } from "./builtins";

export function activate(context: vscode.ExtensionContext): void {

    let tranqDiagnostics = vscode.languages.createDiagnosticCollection("tranquility");
    context.subscriptions.push(tranqDiagnostics);
    subscribeToDocumentChanges(context, tranqDiagnostics);

    vscode.languages.registerHoverProvider("tranquility", {
        provideHover(document, position, token) {
            let range = document.getWordRangeAtPosition(position);
            let word = document.getText(range);

            let builtinFunction = builtInFunctions.find(func => func.name === word);
            if (builtinFunction) return { contents: [builtinFunction.description] };
            return null;
        }
    });
}
