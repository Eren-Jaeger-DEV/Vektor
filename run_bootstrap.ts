import { readFileSync } from "fs";
import { Lexer } from "./src/lexer.js";
import { Parser } from "./src/parser.js";
import { Interpreter } from "./src/interpreter.js";
import { Token, TokenType } from "./src/tokens.js";

const source = readFileSync("vks-compiler/main.vks", "utf-8");
const lexer = new Lexer(source);
const lexResult = lexer.tokenize();

const parser = new Parser(lexResult.tokens);
const parseResult = parser.parse();

if (parseResult.errors.length > 0) {
    console.error("Parse errors:");
    parseResult.errors.forEach(e => console.error(e.toString()));
    process.exit(1);
}

(global as any).__vks_args = ["compile", "vks-compiler/main.vks", "-o", "compiler.vkb"];

const interpreter = new Interpreter();
interpreter.execute(parseResult.program);
console.log("Bootstrap complete!");
