import * as path from "path";
import * as vscode from "vscode";
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
} from "vscode-languageclient/node.js";

let client: LanguageClient;

export function activate(context: vscode.ExtensionContext) {
  const projectRoot = path.resolve(context.extensionPath, "..");
  const mainTs = path.join(projectRoot, "src", "main.ts");
  const lspVk = path.join(projectRoot, "vektor-lsp", "main.vk");

  const serverOptions: ServerOptions = {
    command: "npx",
    args: ["tsx", mainTs, lspVk, "--run"],
    options: {
      cwd: projectRoot,
    },
  };

  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ scheme: "file", language: "vektor" }],
    synchronize: {
      fileEvents: vscode.workspace.createFileSystemWatcher("**/*.vk"),
    },
  };

  client = new LanguageClient(
    "vektorLanguageServer",
    "Vektor Language Server",
    serverOptions,
    clientOptions
  );

  client.start();
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  return client.stop();
}
