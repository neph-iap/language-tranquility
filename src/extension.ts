import * as vscode from "vscode";
import { subscribeToDocumentChanges } from "./diagnostics";

let diagnosticCollection: vscode.DiagnosticCollection;
let disposable = vscode.commands.registerCommand("language.tranquility.info", () => {
    vscode.window.showInformationMessage("Tranquility extension running");
});

export function activate(context: vscode.ExtensionContext): void {

    let tranqDiagnostics = vscode.languages.createDiagnosticCollection("tranquility");
    context.subscriptions.push(tranqDiagnostics);
    subscribeToDocumentChanges(context, tranqDiagnostics);

    let hoverDescriptions = {

        // Keywords
        fun: "\n```\nfun\n```\nDefines a function.\n\nSyntax:\n```\nfun <identifier>(<arguments>) {\n\t<statements>\n}\n```\n",

        // Built in functions
        alloc: "`fun alloc(n: int) -> address`\n\nAllocates a block of memory with \`n\` locations. Returns the address of the first location.",
        button: "`fun button(label, function)`\n\nCreates a button on the HTML page with the given `label`. When the button is pushed, the function `function` is called. An identifier is returned that can be passed to `buttonlabel()` to identify the button.",
        buttonlabel: "`fun button(b, label)`\n\nSets the label on the button identified by `b` to `label`. The value of `b` can be obtained from `button()`.",
        free: "`free(p)`\n\nReturns the previously allocated memory block to the free list. `p` refers to the memory address returned by a call to `alloc()`.\nThis method is currently lacking an implementation.",
        html: "`html(s)`\n\nSends `s` as an HTML code to the HTML window.",
        i2s: "`i2s(str, n)`\n\nConverts the integer `n` to a string, and stores it in the memory location specified by `str`.",
        iprint: "`iprint(n)`\n\nPrints an integer to the console. This will not print a new line by default.",
        iread: "`iread(s)`\n\nPrompts the user to enter an integer with the message `s`.",
        makeimg: "`makeimg()`\n\nCreates an image with no source and returns a reference to the image.",
        makelabel: "`makelabel(s)`\n\nCreates a label setting its contents to `s` and returns an integer label identifier that can be passed to `setlabel()`.",
        maketable: "`maketable(r, c, f)`\n\nCreates a taqble with `r` rows and `c` columns and returns an integer identifying the table. The function `f` is called each time the user clicks on the table. `f` receives the row and column clicked as arguments. The return value of `f` can be used to identify the table for calls to `setcell()` and `setcellcolor()`.",
        random: "`random(n)`\n\nReturns a random number between 0 and `n`, including 0 but not `n`.",
        setcell: "`setcell(t, r, c, s)`\n\nSets the contents of the cell at row `r` and column `c` in table `t` to the string `s`. The value of `t` can be obtained from `maketable()`.",
        setcellcolor: "`setcellcolor(t, r, c, color)`\n\nSets the background color of the cell at row `r` and column `c` in the table `t` to `color`. The value of `t` can be obtained from `maketable()`.",
        setimg: "\n```\nfun setimg(image, src)\n```\nSets the source of an image. The value of `image` can be obtained from a call to `makeimg()`.",
        setlabel: "`setlabel(label, text)\n\nSets the text in `label` to `text`. The value of `label` can be obtained from a call to `makelabel()`.",
        sprint: "\n```\nfun sprint(text: string) -> void\n```\nPrints the string `text` to the console. This will not print a new line by default.",
        sread: "\n```\nfun sread(address, prompt)\n```\nPrompts the user to enter a string with the message `prompt` and stores the result in `address`.",
        stoptimer: "`stoptimer(timer)`\n\nStops the given timer. A reference to the timer can be obtained from `timer()`.",
        timer: "`timer(milliseconds, function)`\n\nSets a timer. The function `function` will be called after `milliseconds` milliseconds have passed. Returns an identifier of this timer that can be used in `stoptimer()`.",
    
        init: "`fun init()`\n\nThe main function for the program. This is the function that will be called when the program is run."
    };

    vscode.languages.registerHoverProvider("tranquility", {
        provideHover(document, position, token) {
            let range = document.getWordRangeAtPosition(position);
            let word = document.getText(range);

            if (Object.keys(hoverDescriptions).includes(word)) return { contents: [hoverDescriptions[word]] };
            return null;
        }
    });
}
