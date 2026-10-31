# Pseudocódigo en español

Extensión de Visual Studio Code para escribir pseudocódigo en español. Incluye
resaltado de sintaxis, comentarios, autocierre e indentación de bloques y
snippets.

## Compatibilidad

Los archivos `.algo`, `.alg` y `.pse` se reconocen automáticamente como
pseudocódigo. También puedes seleccionar **Pseudocódigo** desde el selector de
lenguaje de VS Code.

## Snippets

Escribe un prefijo y pulsa `Tab` para insertar una plantilla:

| Prefijo | Inserta |
| --- | --- |
| `algoritmo` | Bloque de algoritmo |
| `definir` | Declaración de variable |
| `escribir` | Instrucción de salida |
| `leer` | Instrucción de entrada |
| `mientras` | Bucle `Mientras` |
| `para` | Bucle `Para` |
| `repetir` | Bucle `Repetir` |
| `si` | Condicional `Si` / `SiNo` |
| `proceso` | Bloque de proceso |

Al escribir `Algoritmo`, `Proceso`, `Funcion`, `Si`, `Mientras`, `Para` o
`Repetir`, VS Code inserta su cierre correspondiente. Completa la cabecera y
pulsa `Enter` para empezar el bloque con sangría automática.

## Ejemplo

```text
Algoritmo saludo
    Definir nombre Como Texto
    Escribir "¿Cómo te llamas?"
    Leer nombre
    Escribir "Hola, ", nombre
FinAlgoritmo
```

## Ejecutar pseudocódigo

Si tienes instalada la extensión **Code Runner**, abre un archivo `.alg`,
`.algo` o `.pse` y usa su botón **Run Code**. La extensión configura Code Runner
para ejecutar el intérprete desde la terminal integrada, por lo que también
funciona `Leer`.

Si Code Runner no está instalado, puedes usar el botón de ejecución de esta
extensión; la salida aparece en **Output → Pseudocódigo** y los valores de
`Leer` se introducen en el cuadro de entrada de VS Code.
