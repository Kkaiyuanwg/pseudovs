const fs = require('fs');
const { Lexer } = require('./lexer');
const { Parser } = require('./parser');
const { Interpreter } = require('./interpreter');

async function main() {
  const sourcePath = process.argv[2];

  if (!sourcePath) {
    console.error('Uso: node src/cli.js <archivo.alg>');
    process.exit(1);
  }

  const source = fs.readFileSync(sourcePath, 'utf8');
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const program = parser.parseProgram();

  const interpreter = new Interpreter();
  await interpreter.run(program);
}

main().catch((error) => {
  console.error('Error al ejecutar el pseudocódigo:');
  console.error(error.message);
  process.exit(1);
});
