"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.keywordDescriptions = exports.builtInFunctions = void 0;
exports.builtInFunctions = [];
function builtInFunction(func) {
    exports.builtInFunctions.push(func);
}
let alloc = builtInFunction({
    name: "alloc",
    description: "\n```\nfun alloc(locations: Integer) -> Address<Any>\n```\nAllocates a block of memory with `locations` locations. Returns the address of the first location.",
    parameterCount: 2
});
let button = builtInFunction({
    name: "button",
    description: "\n```\nfun button(label: String, onClick: Function) -> Button\n```\nCreates a button on the HTML page with the given `label`. When the button is pushed, the function `onClick` is called. An identifier is returned that can be passed to `buttonlabel()` to identify the button.",
    parameterCount: 2
});
let buttonlabel = builtInFunction({
    name: "buttonlabel",
    description: "\n```\nfun buttonlabel(button: Button, label: String) -> void\n```\nSets the label on the button identified by `b` to `label`. The value of `button` can be obtained from `button()`.",
    parameterCount: 2
});
let free = builtInFunction({
    name: "free",
    description: "\n```\nfun free(address: Address<Any>) -> void\n```\nReturns the previously allocated memory block to the free list. `p` refers to the memory address returned by a call to `alloc()`.\nThis method is currently lacking an implementation.",
    parameterCount: 1
});
let html = builtInFunction({
    name: "html",
    description: "\n```\nfun html(code: HTMLCode) -> void\n```\nSends `code` as an HTML code to the HTML window.",
    parameterCount: 1
});
let i2s = builtInFunction({
    name: "i2s",
    description: "\n```\nfun i2s(address: Address<String>, number: Integer) -> void\n```\nConverts the integer `number` to a string, and stores it in the memory location specified by `address`.",
    parameterCount: 1
});
let iprint = builtInFunction({
    name: "iprint",
    description: "\n```\n iprint(number: Integer) -> void\n```\nPrints an integer to the console. This will not print a new line by default.",
    parameterCount: 1
});
let iread = builtInFunction({
    name: "iread",
    description: "\n```\nfun iread(prompt: String) -> Integer\n```\nPrompts the user to enter an integer with the message `prompt`.",
    parameterCount: 1
});
let makeimg = builtInFunction({
    name: "makeimg",
    description: "\n```\nfun makeimg() -> Image\n```\nCreates an image with no source and returns a reference to the image.",
    parameterCount: 0
});
let makelabel = builtInFunction({
    name: "makelabel",
    description: "\n```\nfun makelabel(text: String) -> Label\n```\nCreates a label setting its contents to `text` and returns an integer label identifier that can be passed to `setlabel()`.",
    parameterCount: 1
});
let maketable = builtInFunction({
    name: "maketable",
    description: "\n```\nfun maketable(rows: Integer, columns: Integer, onClick: Function) -> Table\n```\nCreates a table with `rows` rows and `columns` columns and returns an integer identifying the table. The function `onClick` is called each time the user clicks on the table. `onClick` receives the row and column clicked as arguments. The return value of `onClick` can be used to identify the table for calls to `setcell()` and `setcellcolor()`.",
    parameterCount: 3
});
let random = builtInFunction({
    name: "random",
    description: "\n```\nfun random(max: Integer) -> Integer\n```\nReturns a random number between 0 and `max`, including 0 but not `max`.",
    parameterCount: 1
});
let setcell = builtInFunction({
    name: "setcell",
    description: "\n```\nfun setcell(table: Table, row: Integer, column: Integer, text: String) -> void```\nSets the contents of the cell at row `row` and column `column` in table `table` to the string `text`. The value of `table` can be obtained from `maketable()`.",
    parameterCount: 4
});
let setcellcolor = builtInFunction({
    name: "setcellcolor",
    description: "\n```\nfun setcellcolor(table: Table, row: Integer, column: Integer, color: String) -> void\n```\nSets the background color of the cell at row `row` and column `column` in the table `table` to `color`. The value of `table` can be obtained from `maketable()`.",
    parameterCount: 4
});
let setimg = builtInFunction({
    name: "setimg",
    description: "\n```\nfun setimg(image: Image, src: String) -> void\n```\nSets the source of an image. The value of `image` can be obtained from a call to `makeimg()`.",
    parameterCount: 2
});
let setlabel = builtInFunction({
    name: "setlabel",
    description: "\n```\nfun setlabel(label: Label, text: String) -> void\n```\nSets the text in `label` to `text`. The value of `label` can be obtained from a call to `makelabel()`.",
    parameterCount: 2
});
let sprint = builtInFunction({
    name: "sprint",
    description: "\n```\nfun sprint(text: String) -> void\n```\nPrints the string `text` to the console. This will not print a new line by default.",
    parameterCount: 1
});
let sread = builtInFunction({
    name: "sread",
    description: "\n```\nfun sread(address: Address<String>, prompt: String) -> void\n```\nPrompts the user to enter a string with the message `prompt` and stores the result in `address`.",
    parameterCount: 2
});
let stoptimer = builtInFunction({
    name: "stoptimer",
    description: "\n```\nfun stoptimer(timer: Timer) -> void\n```\nStops the given timer. A reference to the timer can be obtained from `timer()`.",
    parameterCount: 1
});
let timer = builtInFunction({
    name: "timer",
    description: "\n```\nfun timer(milliseconds: Integer, function: Function) -> Timer\n```\nSets a timer. The function `function` will be called after `milliseconds` milliseconds have passed. Returns an identifier of this timer that can be used in `stoptimer()`.",
    parameterCount: 2
});
let init = builtInFunction({
    name: "init",
    description: "\n```\nfun init() -> void\n```\nThe main function for the program. This is the function that will be called when the program is run.",
    parameterCount: 0
});
exports.keywordDescriptions = {
    else: '\n```\nelse "{" "\\n" <stmt-list> "}" "\\n" | \nelse <if-stmt>\n```\nA list of statements to be executed if the proceeding if statement\'s condition is false.',
    fun: "\n```\nfun <name: Identifier>\n```\nDefines a function with the name `name`",
    var: "\n```\nvar <name: Identifier>\n```\nDefines a variable with the name `name`"
};
