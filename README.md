# Language-Tranquility
The `language-tranquility` extension for Visual Studio Code provides language support for the Tranquility language developed at Drexel University by Professor Brian Stuart. Compilation is only accessible to Drexel students that can connect to the remote server at `usr123@tux.cs.drexel.edu`.

## Features
The extension ships with several features, including
 - Syntax highlighting
 - Documentation hovering
 - Error/warning linting

## Windows Usage
### Setup
If you are on Windows, you will need to open Visual Studio Code remotely on a Linux machine. You can do this with your Tux account with the following:
1. Install the [Remote extension pack](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.vscode-remote-extensionpack) for Visual Studio Code.
2. Click The `Open remote window` icon in the lower left corner.
3. Click `Connect to Host...` option.
4. Click `Add New SSH Host...`.
5. Enter `ssh usr123@tux.cs.drexel.edu`
6. Choose a configuration file to update (if prompted)

### Usage
The Tux address is now saved to your computer. To connect:
1. Click The `Open remote window` icon in the lower left corner.
2. Click `Connect to Host...` option.
3. Click `tux.cs.drexel.edu`.
4. A new window will open and prompt you to type in your password.
5. Go to `File > Open File` and choose your file of choice.

## Usage
7. Run `tranqc <filename>.t`.

