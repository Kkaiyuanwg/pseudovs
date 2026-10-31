const KEYWORDS = new Set([
  'ALGORITMO', 'FINALGORITMO',
  'PROCESO', 'FINPROCESO',
  'FUNCION', 'FINFUNCION',
  'DEFINIR', 'COMO',
  'DIMENSION', 'BORRAR', 'PANTALLA', 'MOD',
  'SI', 'ENTONCES', 'SINO', 'FINSI',
  'MIENTRAS', 'HACER', 'FINMIENTRAS',
  'PARA', 'HASTA', 'CON', 'PASO', 'FINPARA',
  'REPETIR', 'QUE', 'HASTAQUE',
  'LEER', 'ESCRIBIR',
  'ENTERO', 'REAL', 'TEXTO', 'CADENA', 'BOOLEANO', 'LOGICO',
  'VERDADERO', 'FALSO',
  'Y', 'O', 'NO',
  'ENTONCES'
]);

const BOOLEAN_VALUES = {
  VERDADERO: true,
  FALSO: false
};

class Lexer {
  constructor(input) {
    this.input = input;
    this.position = 0;
    this.tokens = [];
  }

  tokenize() {
    while (this.position < this.input.length) {
      const char = this.input[this.position];

      if (char === '/' && this.peek(1) === '/') {
        this.skipLineComment();
        continue;
      }

      if (/\s/.test(char)) {
        this.position += 1;
        continue;
      }

      if (char === '"' || char === "'") {
        this.tokens.push(this.readString());
        continue;
      }

      if (/\d/.test(char) || (char === '.' && this.isDigit(this.peek(1)))) {
        this.tokens.push(this.readNumber());
        continue;
      }

      if (/[A-Za-zÁÉÍÓÚáéíóúÑñ_]/.test(char)) {
        this.tokens.push(this.readWord());
        continue;
      }

      if (this.isOperatorStart(char)) {
        this.tokens.push(this.readOperatorOrPunctuation());
        continue;
      }

      throw new Error(`Carácter no soportado: "${char}" en posición ${this.position}`);
    }

    this.tokens.push({ type: 'EOF', value: 'EOF' });
    return this.tokens;
  }

  skipLineComment() {
    while (this.position < this.input.length && this.input[this.position] !== '\n') {
      this.position += 1;
    }
  }

  readString() {
    const quote = this.input[this.position];
    this.position += 1;
    let value = '';

    while (this.position < this.input.length) {
      const current = this.input[this.position];

      if (current === '\\') {
        this.position += 1;
        if (this.position >= this.input.length) {
          break;
        }

        const escaped = this.input[this.position];
        const escapes = {
          n: '\n',
          t: '\t',
          r: '\r',
          '\\': '\\',
          '"': '"',
          "'": "'"
        };

        value += escapes[escaped] ?? escaped;
        this.position += 1;
        continue;
      }

      if (current === quote) {
        this.position += 1;
        return { type: 'STRING', value };
      }

      value += current;
      this.position += 1;
    }

    throw new Error(`Cadena sin cerrar: ${quote}`);
  }

  readNumber() {
    const start = this.position;
    while (this.position < this.input.length && /[0-9.]/.test(this.input[this.position])) {
      this.position += 1;
    }

    const raw = this.input.slice(start, this.position);
    return { type: 'NUMBER', value: Number(raw) };
  }

  readWord() {
    const start = this.position;
    while (this.position < this.input.length) {
      const current = this.input[this.position];
      if (/[A-Za-zÁÉÍÓÚáéíóúÑñ0-9_]/.test(current)) {
        this.position += 1;
      } else {
        break;
      }
    }

    const raw = this.input.slice(start, this.position);
    const upper = raw.toUpperCase();

    if (BOOLEAN_VALUES[upper] !== undefined) {
      return { type: 'BOOLEAN', value: BOOLEAN_VALUES[upper] };
    }

    if (KEYWORDS.has(upper)) {
      return { type: 'KEYWORD', value: upper };
    }

    return { type: 'IDENTIFIER', value: raw };
  }

  readOperatorOrPunctuation() {
    const char = this.input[this.position];
    const next = this.peek(1);

    const twoChar = char + next;
    const twoCharOperators = ['<=', '>=', '==', '!=', '<>', '<-', '=>'];
    if (twoCharOperators.includes(twoChar)) {
      this.position += 2;
      return { type: 'OPERATOR', value: twoChar };
    }

    const singleCharOperators = ['+', '-', '*', '/', '%', '^', '~', '=', '<', '>', '(', ')', '[', ']', ',', ';'];
    if (singleCharOperators.includes(char)) {
      this.position += 1;
      return { type: 'OPERATOR', value: char };
    }

    throw new Error(`Operador no soportado: "${char}"`);
  }

  isOperatorStart(char) {
    return ['+', '-', '*', '/', '%', '^', '~', '=', '<', '>', '(', ')', '[', ']', ',', ';'].includes(char);
  }

  isDigit(char) {
    return /\d/.test(char ?? '');
  }

  peek(offset) {
    return this.input[this.position + offset] ?? '';
  }
}

module.exports = { Lexer };
