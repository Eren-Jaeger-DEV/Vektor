"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const path = require("path");
const vscode = require("vscode");
const node_1 = require("vscode-languageclient/node");
let client;
function activate(context) {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || context.extensionPath;
    const projectRoot = path.resolve(context.extensionPath, "..");
    const mainTs = path.join(projectRoot, "src", "main.ts");
    const lspVks = path.join(projectRoot, "vks-lsp", "main.vks");
    const serverOptions = {
        command: "npx",
        args: ["tsx", mainTs, lspVks, "--run"],
        options: {
            cwd: projectRoot,
        },
    };
    const clientOptions = {
        documentSelector: [{ scheme: "file", language: "vks" }],
        synchronize: {
            fileEvents: vscode.workspace.createFileSystemWatcher("**/*.vks"),
        },
    };
    client = new node_1.LanguageClient("vksLanguageServer", "ViktorScript Language Server", serverOptions, clientOptions);
    client.start();
}
function deactivate() {
    if (!client) {
        return undefined;
    }
    return client.stop();
}
//# sourceMappingURL=extension.js.map