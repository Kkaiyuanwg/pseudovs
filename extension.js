const vscode = require('vscode');
const path = require('path');
const { Lexer } = require('./src/lexer');
const { Parser } = require('./src/parser');
const { Interpreter } = require('./src/interpreter');

async function configureCodeRunner(extensionPath) {
  const runner = vscode.extensions.getExtension('formulahendry.code-runner');
  if (!runner) {
    return false;
  }

  const config = vscode.workspace.getConfiguration('code-runner');
  const mapSetting = config.inspect('executorMapByFileExtension');
  const configuredMap = mapSetting && mapSetting.globalValue
    ? mapSetting.globalValue
    : {};
  const cliPath = path.join(extensionPath, 'src', 'cli.js');
  const executors = {
    '.alg': `node "${cliPath}" $fullFileName`,
    '.algo': `node "${cliPath}" $fullFileName`,
    '.pse': `node "${cliPath}" $fullFileName`
  };
  const nextMap = { ...configuredMap, ...executors };
  const mapNeedsUpdate = Object.keys(executors).some(
    (extension) => configuredMap[extension] !== executors[extension]
  );
  const terminalSetting = config.inspect('runInTerminal');
  const terminalNeedsUpdate = !terminalSetting || terminalSetting.globalValue !== true;

  try {
    if (mapNeedsUpdate) {
      await config.update(
        'executorMapByFileExtension',
        nextMap,
        vscode.ConfigurationTarget.Global
      );
    }

    if (terminalNeedsUpdate) {
      await config.update(
        'runInTerminal',
        true,
        vscode.ConfigurationTarget.Global
      );
    }

    return true;
  } catch (error) {
    vscode.window.showErrorMessage(
      `No se pudo configurar Code Runner: ${error.message}`
    );
    return false;
  }
}

function getActiveDocument() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage('Abre un archivo .alg, .algo o .pse antes de ejecutarlo.');
    return undefined;
  }

  const document = editor.document;
  const allowed = ['.alg', '.algo', '.pse'];
  if (!allowed.includes(path.extname(document.fileName).toLowerCase())) {
    vscode.window.showErrorMessage('El archivo activo no parece ser un pseudocódigo válido.');
    return undefined;
  }

  return document;
}

async function runDocument(document, output) {
  output.clear();
  output.show(true);

  try {
    const tokens = new Lexer(document.getText()).tokenize();
    const program = new Parser(tokens).parseProgram();
    const interpreter = new Interpreter({
      write: (text) => output.appendLine(String(text)),
      read: async (name) => {
        const value = await vscode.window.showInputBox({
          prompt: `Ingrese un valor para ${name}`,
          ignoreFocusOut: true
        });
        if (value !== undefined) {
          output.appendLine(`${name}: ${value}`);
        }
        return value;
      }
    });

    await interpreter.run(program);
  } catch (error) {
    output.appendLine(`Error: ${error.message}`);
    vscode.window.showErrorMessage(`No se pudo ejecutar el pseudocódigo: ${error.message}`);
  }
}

async function activate(context) {
  const codeRunnerAvailable = await configureCodeRunner(context.extensionPath);
  await vscode.commands.executeCommand(
    'setContext',
    'pseudocodigo.codeRunnerAvailable',
    codeRunnerAvailable
  );

  const output = vscode.window.createOutputChannel('Pseudocódigo');
  context.subscriptions.push(output);

  const disposable = vscode.commands.registerCommand('pseudocodigo.runFile', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('Abre un archivo .alg, .algo o .pse antes de ejecutarlo.');
      return;
    }

    if (!(await editor.document.save())) {
      return;
    }

    const document = getActiveDocument();
    if (document) {
      await runDocument(document, output);
    }
  });

  context.subscriptions.push(disposable);
}

function deactivate() {}

module.exports = { activate, deactivate };
