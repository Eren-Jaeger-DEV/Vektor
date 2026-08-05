import * as path from "path";
import * as vscode from "vscode";
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from "vscode-languageclient/node";

let client: LanguageClient;

export function activate(context: vscode.ExtensionContext) {
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || context.extensionPath;
  const projectRoot = path.resolve(context.extensionPath, "..");
  const mainTs = path.join(projectRoot, "src", "main.ts");
  const lspVks = path.join(projectRoot, "vektor-lsp", "main.vk");

  const serverOptions: ServerOptions = {
    command: "npx",
    args: ["tsx", mainTs, lspVks, "--run"],
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
    "VektorScript Language Server",
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
