class Parser {
  constructor(tokens) {
    this.tokens = tokens;
    this.index = 0;
  }

  parseProgram() {
    let name = 'algoritmo';
    if (this.matchKeyword('ALGORITMO')) {
      name = this.consumeIdentifierOrKeyword();
      const body = this.parseBlock(['FINALGORITMO']);
      this.expectKeyword('FINALGORITMO');
      return { type: 'Program', name, body };
    }

    if (this.matchKeyword('PROCESO')) {
      name = this.consumeIdentifierOrKeyword();
      const body = this.parseBlock(['FINPROCESO']);
      this.expectKeyword('FINPROCESO');
      return { type: 'Program', name, body };
    }

    if (this.matchKeyword('FUNCION')) {
      const fnName = this.consumeIdentifierOrKeyword();
      const body = this.parseBlock(['FINFUNCION']);
      this.expectKeyword('FINFUNCION');
      return { type: 'FunctionDef', name: fnName, body };
    }

    throw new Error(`Se esperaba un bloque Algoritmo, Proceso o Funcion.`);
  }

  parseBlock(stopKeywords) {
    const statements = [];

    while (!this.isAtEnd()) {
      while (this.matchOperator(';')) {}

      if (this.isAtEnd()) {
        break;
      }

      const current = this.peek();
      if (current.type === 'KEYWORD' && stopKeywords.includes(current.value)) {
        break;
      }

      statements.push(this.parseStatement());
      this.matchOperator(';');
    }

    return statements;
  }

  parseStatement() {
    if (this.matchKeyword('DEFINIR')) {
      return this.parseDefineStatement();
    }

    if (this.matchKeyword('DIMENSION')) {
      const name = this.consumeIdentifier();
      const dimensions = this.parseIndexList();
      return { type: 'Dimension', name, dimensions };
    }

    if (this.matchKeyword('BORRAR')) {
      this.matchKeyword('PANTALLA');
      return { type: 'ClearScreen' };
    }

    if (this.matchKeyword('LEER')) {
      const names = this.parseNameList();
      return { type: 'Read', names };
    }

    if (this.matchKeyword('ESCRIBIR')) {
      const args = this.parseExpressionList();
      return { type: 'Write', args };
    }

    if (this.matchKeyword('SI')) {
      const condition = this.parseExpression();
      this.expectKeyword('ENTONCES');
      const thenBranch = this.parseBlock(['SINO', 'FINSI']);
      let elseBranch = null;
      if (this.matchKeyword('SINO')) {
        elseBranch = this.parseBlock(['FINSI']);
      }
      this.expectKeyword('FINSI');
      return { type: 'If', condition, thenBranch, elseBranch };
    }

    if (this.matchKeyword('MIENTRAS')) {
      const condition = this.parseExpression();
      this.expectKeyword('HACER');
      const body = this.parseBlock(['FINMIENTRAS']);
      this.expectKeyword('FINMIENTRAS');
      return { type: 'While', condition, body };
    }

    if (this.matchKeyword('REPETIR')) {
      const body = this.parseBlock(['HASTA']);
      this.expectKeyword('HASTA');
      this.expectKeyword('QUE');
      const condition = this.parseExpression();
      return { type: 'RepeatUntil', body, condition };
    }

    if (this.matchKeyword('PARA')) {
      const variable = this.consumeIdentifier();
      this.expectOperator('<-');
      const from = this.parseExpression();
      this.expectKeyword('HASTA');
      const to = this.parseExpression();
      let step = { type: 'Literal', value: 1 };
      if (this.matchKeyword('CON')) {
        this.expectKeyword('PASO');
        step = this.parseExpression();
      }
      this.expectKeyword('HACER');
      const body = this.parseBlock(['FINPARA']);
      this.expectKeyword('FINPARA');
      return { type: 'For', variable, from, to, step, body };
    }

    if (this.peek().type === 'IDENTIFIER') {
      const nextToken = this.tokens[this.index + 1];
      const name = this.consumeIdentifier();
      if (this.matchOperator('[')) {
        const indexes = this.parseIndexList(true);
        if (this.matchOperator('<-') || this.matchOperator('=')) {
          const value = this.parseExpression();
          return { type: 'ArrayAssignment', name, indexes, value };
        }
        return {
          type: 'ExpressionStatement',
          expression: { type: 'ArrayAccess', name, indexes }
        };
      }

      if (this.matchOperator('<-') || this.matchOperator('=')) {
        const value = this.parseExpression();
        return { type: 'Assignment', name, value };
      }

      if (nextToken && nextToken.type === 'OPERATOR' && nextToken.value === '(') {
        const callArgs = this.parseCallArguments();
        return { type: 'CallStatement', name, args: callArgs };
      }

      return { type: 'ExpressionStatement', expression: { type: 'Variable', name } };
    }

    if (this.peek().type === 'KEYWORD' && this.peek().value === 'HASTAQUE') {
      throw new Error('Se encontró "Hasta Que" sin un bloque Repetir previo.');
    }

    throw new Error(`Instrucción no soportada: ${this.peek().value}`);
  }

  parseDefineStatement() {
    const names = this.parseNameList();
    this.expectKeyword('COMO');
    const dataType = this.consumeIdentifierOrKeyword();
    return { type: 'Define', names, dataType };
  }

  parseNameList() {
    const names = [this.consumeIdentifier()];
    while (this.matchOperator(',')) {
      names.push(this.consumeIdentifier());
    }
    return names;
  }

  parseIndexList(openBracketConsumed = false) {
    if (!openBracketConsumed) {
      this.expectOperator('[');
    }
    const indexes = [this.parseExpression()];
    while (this.matchOperator(',')) {
      indexes.push(this.parseExpression());
    }
    this.expectOperator(']');
    return indexes;
  }

  parseExpressionList() {
    const values = [this.parseExpression()];
    while (this.matchOperator(',')) {
      values.push(this.parseExpression());
    }
    return values;
  }

  parseCallArguments() {
    this.expectOperator('(');
    const args = [];
    if (!this.matchOperator(')')) {
      args.push(this.parseExpression());
      while (this.matchOperator(',')) {
        args.push(this.parseExpression());
      }
      this.expectOperator(')');
    }
    return args;
  }

  parseExpression() {
    return this.parseLogicalOr();
  }

  parseLogicalOr() {
    let expr = this.parseLogicalAnd();
    while (this.matchKeyword('O')) {
      expr = { type: 'Binary', op: 'OR', left: expr, right: this.parseLogicalAnd() };
    }
    return expr;
  }

  parseLogicalAnd() {
    let expr = this.parseComparison();
    while (this.matchKeyword('Y')) {
      expr = { type: 'Binary', op: 'AND', left: expr, right: this.parseComparison() };
    }
    return expr;
  }

  parseComparison() {
    let expr = this.parseAdditive();
    while (this.isComparisonOperator()) {
      const operator = this.consumeOperator();
      const right = this.parseAdditive();
      expr = { type: 'Binary', op: operator, left: expr, right };
    }
    return expr;
  }

  parseAdditive() {
    let expr = this.parseMultiplicative();
    while (this.matchOperator('+') || this.matchOperator('-')) {
      const operator = this.previous().value;
      const right = this.parseMultiplicative();
      expr = { type: 'Binary', op: operator, left: expr, right };
    }
    return expr;
  }

  parseMultiplicative() {
    let expr = this.parseUnary();
    while (
      this.matchOperator('*')
      || this.matchOperator('/')
      || this.matchOperator('%')
      || this.matchKeyword('MOD')
    ) {
      const operator = this.previous().value;
      const right = this.parseUnary();
      expr = { type: 'Binary', op: operator === 'MOD' ? '%' : operator, left: expr, right };
    }
    return expr;
  }

  parseUnary() {
    if (this.matchOperator('+') || this.matchOperator('-') || this.matchOperator('~')) {
      const operator = this.previous().value;
      const expr = this.parseUnary();
      return { type: 'Unary', op: operator === '~' ? 'NOT' : operator, expr };
    }

    if (this.matchKeyword('NO')) {
      return { type: 'Unary', op: 'NOT', expr: this.parseUnary() };
    }

    return this.parsePrimary();
  }

  parsePrimary() {
    if (this.peek().type === 'NUMBER') {
      return { type: 'Literal', value: this.next().value };
    }

    if (this.peek().type === 'STRING') {
      return { type: 'Literal', value: this.next().value };
    }

    if (this.peek().type === 'BOOLEAN') {
      return { type: 'Literal', value: this.next().value };
    }

    if (this.peek().type === 'IDENTIFIER') {
      const name = this.next().value;
      if (this.matchOperator('[')) {
        const indexes = this.parseIndexList(true);
        return { type: 'ArrayAccess', name, indexes };
      }

      if (this.matchOperator('(')) {
        const args = [];
        if (!this.matchOperator(')')) {
          args.push(this.parseExpression());
          while (this.matchOperator(',')) {
            args.push(this.parseExpression());
          }
          this.expectOperator(')');
        }
        return { type: 'Call', name, args };
      }
      return { type: 'Variable', name };
    }

    if (this.matchOperator('(')) {
      const expr = this.parseExpression();
      this.expectOperator(')');
      return expr;
    }

    throw new Error(`Expresión inválida cerca de: ${this.peek().value}`);
  }

  consumeIdentifier() {
    const token = this.peek();
    if (token.type !== 'IDENTIFIER') {
      throw new Error(`Se esperaba un identificador, pero se encontró: ${token.value}`);
    }
    this.index += 1;
    return token.value;
  }

  consumeIdentifierOrKeyword() {
    const token = this.peek();
    if (token.type === 'IDENTIFIER' || token.type === 'KEYWORD') {
      this.index += 1;
      return token.value;
    }
    throw new Error(`Se esperaba un nombre, pero se encontró: ${token.value}`);
  }

  matchOperator(value) {
    if (this.peek().type === 'OPERATOR' && this.peek().value === value) {
      this.index += 1;
      return true;
    }
    return false;
  }

  expectOperator(value) {
    if (!this.matchOperator(value)) {
      throw new Error(`Se esperaba operador "${value}", pero se encontró "${this.peek().value}".`);
    }
  }

  matchKeyword(value) {
    if (this.peek().type === 'KEYWORD' && this.peek().value === value) {
      this.index += 1;
      return true;
    }
    return false;
  }

  expectKeyword(value) {
    if (!this.matchKeyword(value)) {
      throw new Error(`Se esperaba la palabra clave "${value}", pero se encontró "${this.peek().value}".`);
    }
  }

  previous() {
    return this.tokens[this.index - 1];
  }

  next() {
    const token = this.peek();
    this.index += 1;
    return token;
  }

  peek() {
    return this.tokens[this.index] || { type: 'EOF', value: 'EOF' };
  }

  isAtEnd() {
    return this.peek().type === 'EOF';
  }

  isComparisonOperator() {
    const value = this.peek().value;
    return ['=', '==', '!=', '<>', '<', '<=', '>', '>='].includes(value);
  }

  consumeOperator() {
    const token = this.peek();
    if (!this.isComparisonOperator()) {
      throw new Error(`Operador de comparación inválido: ${token.value}`);
    }
    this.index += 1;
    return token.value;
  }
}

module.exports = { Parser };
