// ============================================================
// Viktor Script — AST Printer
// ============================================================
// Utility to print the AST into a readable string tree format.
// Useful for debugging the parser output.
// ============================================================

import * as ast from "./ast.js";

export class ASTPrinter {
  private indentLevel = 0;

  public print(program: ast.Program): string {
    this.indentLevel = 0;
    return this.printNode(program);
  }

  private printNode(node: any, prefix: string = "", isLast: boolean = true): string {
    if (!node) return "";

    let result = "";
    
    // For root nodes, don't prefix
    const currentPrefix = this.indentLevel === 0 ? "" : prefix + (isLast ? "└── " : "├── ");
    const childPrefix = this.indentLevel === 0 ? "" : prefix + (isLast ? "    " : "│   ");

    this.indentLevel++;

    if (Array.isArray(node)) {
      if (node.length === 0) {
        result += `${currentPrefix}[]\n`;
      } else {
        result += `${currentPrefix}[\n`;
        for (let i = 0; i < node.length; i++) {
          result += this.printNode(node[i], childPrefix, i === node.length - 1);
        }
        result += `${childPrefix.replace(/    $/, "└── ").replace(/│   $/, "└── ")}]\n`;
      }
    } else if (typeof node === "object" && node !== null) {
      if ("kind" in node) {
        // It's an ASTNode
        const kind = node.kind;
        let inlineInfo = "";

        switch (kind) {
          case "PrimitiveType": inlineInfo = ` ${(node as ast.PrimitiveType).name}`; break;
          case "IntegerLiteral": inlineInfo = ` ${(node as ast.IntegerLiteral).value}`; break;
          case "FloatLiteral": inlineInfo = ` ${(node as ast.FloatLiteral).value}`; break;
          case "StringLiteral": inlineInfo = ` "${(node as ast.StringLiteral).value}"`; break;
          case "CharLiteral": inlineInfo = ` '${(node as ast.CharLiteral).value}'`; break;
          case "BooleanLiteral": inlineInfo = ` ${(node as ast.BooleanLiteral).value}`; break;
          case "Identifier": inlineInfo = ` ${(node as ast.Identifier).name}`; break;
          case "ImportDecl": inlineInfo = ` "${(node as ast.ImportDecl).path}"`; break;
        }

        result += `${currentPrefix}${kind}${inlineInfo}\n`;

        // Get children (properties that are objects/arrays and not simple values or tokens)
        const keys = Object.keys(node).filter(
          (k) => 
            k !== "kind" && 
            k !== "line" && 
            k !== "column" && 
            k !== "operator" && // We might print operators separately if needed
            k !== "name" && // Handled inline if Primitive or Identifier, otherwise child
            k !== "value" &&
            k !== "path"
        );
        
        // Special handling for operators
        if ("operator" in node && (node as any).operator) {
           const op = (node as any).operator;
           if (op && op.lexeme) {
               keys.unshift("_operator");
               (node as any)._operator = op.lexeme;
           }
        }
        
        // Ensure name is printed if it's a struct or function decl
        if ((kind === "StructDecl" || kind === "FunctionDecl" || kind === "StructLiteral") && "name" in node) {
            keys.unshift("_name");
            if (typeof (node as any).name === "string") {
                 (node as any)._name = (node as any).name;
            } else {
                 (node as any)._name = (node as any).name.name;
            }
        }

        for (let i = 0; i < keys.length; i++) {
          const key = keys[i];
          const child = node[key];
          
          if (child !== undefined) {
             const isLastChild = i === keys.length - 1;
             
             if (typeof child === "string" || typeof child === "number" || typeof child === "boolean") {
                result += `${childPrefix}${isLastChild ? "└── " : "├── "}${key}: ${child}\n`;
             } else {
                // Wrap in a named node for clarity
                result += `${childPrefix}${isLastChild ? "└── " : "├── "}${key}:\n`;
                result += this.printNode(child, childPrefix + (isLastChild ? "    " : "│   "), true);
             }
          }
        }

      } else {
         // Generic object (like StructField or FunctionParam)
         let inlineInfo = "";
         if ("name" in node && typeof node.name === "object" && node.name.kind === "Identifier") {
             inlineInfo = `name: ${node.name.name}`;
         }
         
         result += `${currentPrefix}Object ${inlineInfo}\n`;
         
         const keys = Object.keys(node).filter(k => k !== "line" && k !== "column" && k !== "name");
         for (let i = 0; i < keys.length; i++) {
             const key = keys[i];
             const child = node[key];
             const isLastChild = i === keys.length - 1;
             
             result += `${childPrefix}${isLastChild ? "└── " : "├── "}${key}:\n`;
             result += this.printNode(child, childPrefix + (isLastChild ? "    " : "│   "), true);
         }
      }
    } else {
      result += `${currentPrefix}${node}\n`;
    }

    this.indentLevel--;
    return result;
  }
}
