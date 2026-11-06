import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
function format(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) format(file);
    else if (/\.(ts|tsx)$/.test(file) && !file.endsWith('.d.ts')) {
      const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
      if (source.parseDiagnostics.length) throw new Error(`Cannot format invalid syntax: ${file}`);
      fs.writeFileSync(file, printer.printFile(source));
    }
  }
}
format('src');
format('tests');
