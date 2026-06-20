import { readFileSync } from 'fs';
import { Lexer } from './src/lexer.js';
import { Parser } from './src/parser.js';

const source = readFileSync('test_generics.vks', 'utf-8');
const lexer = new Lexer(source);
const { tokens, errors: lexErrors } = lexer.tokenize();
if (lexErrors.length > 0) {
  console.error("Lexer Errors:", lexErrors);
  process.exit(1);
}

const parser = new Parser(tokens);
const { program, errors: parseErrors } = parser.parse();
if (parseErrors.length > 0) {
  console.error("Parser Errors:", parseErrors);
  process.exit(1);
}

console.log(JSON.stringify(program, null, 2));
