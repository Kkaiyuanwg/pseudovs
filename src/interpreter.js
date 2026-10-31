const readline = require('readline');

class Interpreter {
  constructor({ write = console.log, read } = {}) {
    this.environment = new Map();
    this.arrayDimensions = new Map();
    this.output = [];
    this.inputInterface = null;
    this.write = write;
    this.read = read;
  }

  async run(program) {
    try {
      await this.executeBlock(program.body);
      return this.output;
    } finally {
      if (this.inputInterface) {
        this.inputInterface.close();
      }
    }
  }

  async executeBlock(statements) {
    for (const statement of statements) {
      await this.execute(statement);
    }
  }

  async execute(node) {
    switch (node.type) {
      case 'Program':
        await this.executeBlock(node.body);
        return null;
      case 'Define': {
        for (const name of node.names) {
          const key = this.normalizeName(name);
          if (!this.environment.has(key)) {
            this.environment.set(key, null);
          }
        }
        return null;
      }
      case 'Dimension': {
        const dimensions = [];
        for (const expression of node.dimensions) {
          const size = this.getArrayIndex(await this.evaluate(expression), node.name);
          if (size < 1) {
            throw new Error(`La dimensión del arreglo "${node.name}" debe ser mayor que cero.`);
          }
          dimensions.push(size);
        }
        const key = this.normalizeName(node.name);
        this.arrayDimensions.set(key, dimensions);
        this.environment.set(key, this.createArray(dimensions));
        return null;
      }
      case 'ClearScreen':
        return null;
      case 'Assignment': {
        const value = await this.evaluate(node.value);
        this.environment.set(this.normalizeName(node.name), value);
        return value;
      }
      case 'ArrayAssignment': {
        const indexes = [];
        for (const expression of node.indexes) {
          indexes.push(await this.evaluate(expression));
        }
        const value = await this.evaluate(node.value);
        this.setArrayValue(node.name, indexes, value);
        return value;
      }
      case 'Read': {
        for (const name of node.names) {
          const value = await this.askForInput(name);
          this.environment.set(this.normalizeName(name), this.coerceValue(value));
        }
        return null;
      }
      case 'Write': {
        const parts = [];
        for (const expression of node.args) {
          const value = await this.evaluate(expression);
          parts.push(this.stringify(value));
        }
        const text = parts.join('');
        this.output.push(text);
        this.write(text);
        return text;
      }
      case 'If': {
        const condition = await this.evaluate(node.condition);
        if (Boolean(condition)) {
          await this.executeBlock(node.thenBranch || []);
        } else if (node.elseBranch) {
          await this.executeBlock(node.elseBranch);
        }
        return null;
      }
      case 'While': {
        while (Boolean(await this.evaluate(node.condition))) {
          await this.executeBlock(node.body);
        }
        return null;
      }
      case 'For': {
        let index = await this.evaluate(node.from);
        const end = await this.evaluate(node.to);
        const step = await this.evaluate(node.step);
        const direction = step >= 0 ? 1 : -1;

        while ((direction > 0 ? index <= end : index >= end)) {
          this.environment.set(this.normalizeName(node.variable), index);
          await this.executeBlock(node.body);
          index += step;
        }
        return null;
      }
      case 'RepeatUntil': {
        do {
          await this.executeBlock(node.body);
        } while (!Boolean(await this.evaluate(node.condition)));
        return null;
      }
      case 'ExpressionStatement':
        return await this.evaluate(node.expression);
      case 'CallStatement': {
        await this.callFunction(node.name, node.args);
        return null;
      }
      default:
        throw new Error(`Tipo de nodo no soportado: ${node.type}`);
    }
  }

  async evaluate(node) {
    switch (node.type) {
      case 'Literal':
        return node.value;
      case 'Variable': {
        const key = this.normalizeName(node.name);
        if (!this.environment.has(key)) {
          this.environment.set(key, 0);
        }
        return this.environment.get(key);
      }
      case 'ArrayAccess': {
        const indexes = [];
        for (const expression of node.indexes) {
          indexes.push(await this.evaluate(expression));
        }
        return this.getArrayValue(node.name, indexes);
      }
      case 'Unary': {
        const value = await this.evaluate(node.expr);
        switch (node.op) {
          case '+': return Number(value);
          case '-': return -Number(value);
          case 'NOT': return !Boolean(value);
          default: throw new Error(`Operador unario no soportado: ${node.op}`);
        }
      }
      case 'Binary': {
        const left = await this.evaluate(node.left);
        const right = await this.evaluate(node.right);
        return this.applyBinaryOperator(left, node.op, right);
      }
      case 'Call': {
        return await this.callFunction(node.name, node.args);
      }
      default:
        throw new Error(`Expresión no soportada: ${node.type}`);
    }
  }

  getArray(name) {
    const key = this.normalizeName(name);
    if (!this.environment.has(key)) {
      this.environment.set(key, []);
    }

    const array = this.environment.get(key);
    if (!Array.isArray(array)) {
      throw new Error(`La variable "${name}" no es un arreglo.`);
    }
    return array;
  }

  createArray(dimensions, depth = 0) {
    const values = new Array(dimensions[depth] + 1).fill(null);
    if (depth + 1 < dimensions.length) {
      for (let index = 1; index < values.length; index += 1) {
        values[index] = this.createArray(dimensions, depth + 1);
      }
    }
    return values;
  }

  getArrayValue(name, rawIndexes) {
    const key = this.normalizeName(name);
    const dimensions = this.arrayDimensions.get(key);
    const indexes = rawIndexes.map((value) => this.getArrayIndex(value, name));
    if (dimensions && dimensions.length !== indexes.length) {
      throw new Error(`El arreglo "${name}" requiere ${dimensions.length} índice(s).`);
    }

    let value = this.getArray(name);
    for (let position = 0; position < indexes.length; position += 1) {
      const index = indexes[position];
      if (dimensions && index < 1) {
        throw new Error(`Índice ${index} fuera del rango del arreglo "${name}".`);
      }
      if (dimensions && index > dimensions[position]) {
        throw new Error(`Índice ${index} fuera del rango del arreglo "${name}".`);
      }
      if (index >= value.length) {
        throw new Error(`Índice ${index} fuera del rango del arreglo "${name}".`);
      }
      value = value[index];
      if (value === undefined) {
        return null;
      }
    }
    return value;
  }

  setArrayValue(name, rawIndexes, assignedValue) {
    const key = this.normalizeName(name);
    const dimensions = this.arrayDimensions.get(key);
    const indexes = rawIndexes.map((value) => this.getArrayIndex(value, name));
    if (dimensions && dimensions.length !== indexes.length) {
      throw new Error(`El arreglo "${name}" requiere ${dimensions.length} índice(s).`);
    }

    let target = this.getArray(name);
    for (let position = 0; position < indexes.length; position += 1) {
      const index = indexes[position];
      if (dimensions && index < 1) {
        throw new Error(`Índice ${index} fuera del rango del arreglo "${name}".`);
      }
      if (dimensions && index > dimensions[position]) {
        throw new Error(`Índice ${index} fuera del rango del arreglo "${name}".`);
      }
      if (dimensions && index >= target.length) {
        throw new Error(`Índice ${index} fuera del rango del arreglo "${name}".`);
      }
      if (position === indexes.length - 1) {
        target[index] = assignedValue;
        return;
      }
      if (!Array.isArray(target[index])) {
        target[index] = [];
      }
      target = target[index];
    }
  }

  normalizeName(name) {
    return String(name).toLocaleLowerCase();
  }

  getArrayIndex(value, name) {
    const index = this.coerceNumber(value);
    if (!Number.isInteger(index) || index < 0) {
      throw new Error(`El índice del arreglo "${name}" debe ser un entero no negativo.`);
    }
    return index;
  }

  applyBinaryOperator(left, operator, right) {
    switch (operator) {
      case '+':
        if (typeof left === 'string' || typeof right === 'string') {
          return String(left) + String(right);
        }
        return this.coerceNumber(left) + this.coerceNumber(right);
      case '-':
        return this.coerceNumber(left) - this.coerceNumber(right);
      case '*':
        return this.coerceNumber(left) * this.coerceNumber(right);
      case '/':
        return this.coerceNumber(left) / this.coerceNumber(right);
      case '%':
        return this.coerceNumber(left) % this.coerceNumber(right);
      case '^':
        return Math.pow(this.coerceNumber(left), this.coerceNumber(right));
      case '=':
      case '==':
        return left == right;
      case '!=':
      case '<>':
        return left != right;
      case '<':
        return left < right;
      case '<=':
        return left <= right;
      case '>':
        return left > right;
      case '>=':
        return left >= right;
      case 'AND':
        return Boolean(left) && Boolean(right);
      case 'OR':
        return Boolean(left) || Boolean(right);
      default:
        throw new Error(`Operador binario no soportado: ${operator}`);
    }
  }

  stringify(value) {
    if (value === null || value === undefined) {
      return '';
    }
    return String(value);
  }

  coerceNumber(value) {
    const numericValue = Number(value);
    if (Number.isNaN(numericValue)) {
      throw new Error(`Valor no numérico: ${value}`);
    }
    return numericValue;
  }

  coerceValue(value) {
    if (value === 'VERDADERO') return true;
    if (value === 'FALSO') return false;
    if (/^\d+$/.test(value)) return Number(value);
    if (/^\d+\.?\d*$/.test(value)) return Number(value);
    return value;
  }

  async askForInput(name) {
    if (this.read) {
      const value = await this.read(name);
      if (value === undefined || value === null) {
        throw new Error('La lectura de datos fue cancelada.');
      }
      return String(value).trim();
    }

    if (!this.inputInterface) {
      this.inputInterface = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
    }

    return new Promise((resolve) => {
      this.inputInterface.question(`${name}: `, (result) => resolve(result.trim()));
    });
  }

  async callFunction(name, args) {
    const normalized = String(name).toLowerCase();
    const values = [];
    for (const arg of args) {
      values.push(await this.evaluate(arg));
    }

    const builtins = {
      raiz: (a) => Math.sqrt(this.coerceNumber(a)),
      abs: (a) => Math.abs(this.coerceNumber(a)),
      redondear: (a) => Math.round(this.coerceNumber(a)),
      truncar: (a) => Math.trunc(this.coerceNumber(a)),
      trunc: (a) => Math.trunc(this.coerceNumber(a)),
      aleatorio: () => Math.random(),
      azar: (max) => {
        const limit = Math.floor(this.coerceNumber(max));
        if (limit <= 0) {
          throw new Error('azar() requiere un límite mayor que cero.');
        }
        return Math.floor(Math.random() * limit);
      },
      longitud: (a) => String(a).length,
      mayusculas: (a) => String(a).toUpperCase(),
      minusculas: (a) => String(a).toLowerCase(),
      concatenar: (...parts) => parts.join('')
    };

    if (!builtins[normalized]) {
      throw new Error(`Función no soportada: ${name}`);
    }

    if (normalized === 'concatenar') {
      return builtins[normalized](...values);
    }

    return builtins[normalized](values[0]);
  }
}

module.exports = { Interpreter };
