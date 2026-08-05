"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const path = require("path");
const vscode = require("vscode");
const node_js_1 = require("vscode-languageclient/node.js");
let client;
function activate(context) {
    const projectRoot = path.resolve(context.extensionPath, "..");
    const mainTs = path.join(projectRoot, "src", "main.ts");
    const lspVk = path.join(projectRoot, "vektor-lsp", "main.vk");
    const serverOptions = {
        command: "npx",
        args: ["tsx", mainTs, lspVk, "--run"],
        options: {
            cwd: projectRoot,
        },
    };
    const clientOptions = {
        documentSelector: [{ scheme: "file", language: "vektor" }],
        synchronize: {
            fileEvents: vscode.workspace.createFileSystemWatcher("**/*.vk"),
        },
    };
    client = new node_js_1.LanguageClient("vektorLanguageServer", "Vektor Language Server", serverOptions, clientOptions);
    client.start();
}
function deactivate() {
    if (!client) {
        return undefined;
    }
    return client.stop();
}
//# sourceMappingURL=extension.js.map