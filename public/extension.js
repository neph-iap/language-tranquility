"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = void 0;
const vscode = require("vscode");
const diagnostics_1 = require("./diagnostics");
let diagnosticCollection;
let disposable = vscode.commands.registerCommand("language.tranquility.info", () => {
    vscode.window.showInformationMessage("Tranquility extension running");
});
function activate(context) {
    let tranqDiagnostics = vscode.languages.createDiagnosticCollection("tranquility");
    context.subscriptions.push(tranqDiagnostics);
    (0, diagnostics_1.subscribeToDocumentChanges)(context, tranqDiagnostics);
    let hoverDescriptions = {
        fun: "\n```\nfun\n```\nDefines a function.\n\nSyntax:\n```\nfun <identifier>(<arguments>) {\n\t<statements>\n}\n```\n",
        alloc: "\n```\nfun alloc(n: integer) -> address<any\n```\nAllocates a block of memory with \`n\` locations. Returns the address of the first location.",
        button: "\n```\nfun button(label, function)\n```\nCreates a button on the HTML page with the given `label`. When the button is pushed, the function `function` is called. An identifier is returned that can be passed to `buttonlabel()` to identify the button.",
        buttonlabel: "\n```\nfun button(b, label)\n```\nSets the label on the button identified by `b` to `label`. The value of `b` can be obtained from `button()`.",
        free: "\n```\nfun free(p)\n```\nReturns the previously allocated memory block to the free list. `p` refers to the memory address returned by a call to `alloc()`.\nThis method is currently lacking an implementation.",
        html: "\n```\nfun html(s)\n```\nSends `s` as an HTML code to the HTML window.",
        i2s: "\n```\nfun i2s(str, n)\n```\nConverts the integer `n` to a string, and stores it in the memory location specified by `str`.",
        iprint: "\n```fun iprint(n)`\n\nPrints an integer to the console. This will not print a new line by default.",
        iread: "\n```\nfun iread(s)\n```\nPrompts the user to enter an integer with the message `s`.",
        makeimg: "\n```\nfun makeimg()\n```\nCreates an image with no source and returns a reference to the image.",
        makelabel: "\n```\nfun makelabel(s)\n```\nCreates a label setting its contents to `s` and returns an integer label identifier that can be passed to `setlabel()`.",
        maketable: "\n```\nfun maketable(rowCount: integer, colCount: integer, onClick: function) -> void\n```\nCreates a table with `rowCount` rows and `colCount` columns and returns an integer identifying the table. The function `onClick` is called each time the user clicks on the table. `onClick` receives the row and column clicked as arguments. The return value of `onClick` can be used to identify the table for calls to `setcell()` and `setcellcolor()`.",
        random: "\n```\nfun random(n)\n```\nReturns a random number between 0 and `n`, including 0 but not `n`.",
        setcell: "\n```\nfun setcell(t, r, c, s)```\nSets the contents of the cell at row `r` and column `c` in table `t` to the string `s`. The value of `t` can be obtained from `maketable()`.",
        setcellcolor: "\n```\nfun setcellcolor(t, r, c, color)\n```\nSets the background color of the cell at row `r` and column `c` in the table `t` to `color`. The value of `t` can be obtained from `maketable()`.",
        setimg: "\n```\nfun setimg(image, src)\n```\nSets the source of an image. The value of `image` can be obtained from a call to `makeimg()`.",
        setlabel: "\n```\nfun setlabel(label, text)\n```\nSets the text in `label` to `text`. The value of `label` can be obtained from a call to `makelabel()`.",
        sprint: "\n```\nfun sprint(text: string) -> void\n```\nPrints the string `text` to the console. This will not print a new line by default.",
        sread: "\n```\nfun sread(address, prompt)\n```\nPrompts the user to enter a string with the message `prompt` and stores the result in `address`.",
        stoptimer: "\n```\nfun stoptimer(timer)\n```\nStops the given timer. A reference to the timer can be obtained from `timer()`.",
        timer: "\n```\nfun timer(milliseconds, function)\n```\nSets a timer. The function `function` will be called after `milliseconds` milliseconds have passed. Returns an identifier of this timer that can be used in `stoptimer()`.",
        init: "\n```\nfun init() -> void\n```\nThe main function for the program. This is the function that will be called when the program is run."
    };
    vscode.languages.registerHoverProvider("tranquility", {
        provideHover(document, position, token) {
            let range = document.getWordRangeAtPosition(position);
            let word = document.getText(range);
            if (Object.keys(hoverDescriptions).includes(word))
                return { contents: [hoverDescriptions[word]] };
            return null;
        }
    });
}
exports.activate = activate;
