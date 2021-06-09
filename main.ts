import * as ts from 'typescript';
import * as path from 'path';

function getAvailableExports(entryFilePath: string) {
  const program = createProgramForEntryFile(entryFilePath);
  const entrySourceFile = program.getSourceFile(entryFilePath);
  const results = processSourceFile(entrySourceFile, program);

  console.log(Object.keys(results))
}

function createProgramForEntryFile(entryFilePath: string) {
  const compilerOpts = { moduleResolution: ts.ModuleResolutionKind.NodeJs };
  const rootFiles = [entryFilePath];
  return ts.createProgram(rootFiles, compilerOpts);
}

function processSourceFile(sourceFile: ts.SourceFile, program: ts.Program, availableExports: IAvailableExports = {}, elements: ts.ExportSpecifier[] = null) {
  const reExportDeclarations = sourceFile.statements.filter(ts.isExportDeclaration).filter(exportDecl => exportDecl.moduleSpecifier);
  const reExportedSourceFiles = getSourceFilesForReExportedModules(reExportDeclarations, sourceFile, program);

  findExportsInSourceFile(sourceFile, availableExports, elements);

  reExportedSourceFiles.forEach((childSourceFileWithElements) => {
    const { sourceFile: childSourceFile, elements } = childSourceFileWithElements;
    processSourceFile(childSourceFile, program, availableExports, elements)
  })

  return availableExports;
}

function findExportsInSourceFile(sourceFile: ts.SourceFile, availableExports: IAvailableExports, elements: ts.ExportSpecifier[]): void {
  ts.forEachChild(sourceFile, visitor.bind(this, availableExports, null, elements));
}

interface ISourceFileWithElements {
  sourceFile: ts.SourceFile,
  elements: ts.ExportSpecifier[]
}

function getSourceFilesForReExportedModules(exportDeclarations: ts.ExportDeclaration[], currentSourceFile: ts.SourceFile, program: ts.Program): ISourceFileWithElements[] {
  const sourceFiles = [];

  exportDeclarations.forEach((exportDecl) => {
    const moduleSpecifier = exportDecl.moduleSpecifier;
    const dirName = path.dirname(currentSourceFile.fileName);
    const relativePath = replaceQuotes(moduleSpecifier.getText(currentSourceFile))
    const fileName = path.resolve(dirName, relativePath);

    const elements = exportDecl.exportClause ? exportDecl.exportClause.elements : null;

    const newSourceFile = findSourceFile(fileName, program);
    if (newSourceFile) {
      sourceFiles.push({
        sourceFile: newSourceFile,
        elements,
      });
    }
  })

  return sourceFiles;
}

function replaceQuotes(str: string) {
  return str.replace(/["']/g, '')
}

function findSourceFile(filePath: string, program: ts.Program): ts.SourceFile {
  return program.getSourceFile(filePath) ||
    program.getSourceFile(`${filePath}.ts`) ||
    program.getSourceFile(`${filePath}/index.ts`) ||
    null
}

function visitor(availableExports: IAvailableExports, parent: ts.Node, elements: ts.ExportSpecifier[], node: ts.Node) {
  // export const foo = 'a'
  if (node.kind === ts.SyntaxKind.ExportKeyword) {
    sensesPushExportDependencies(availableExports, parent, elements);
    return;
    // const foo = 'a';
    // export { foo, foo as fooAlias }
  } else if (ts.isExportDeclaration(node)) {
    if (node.exportClause && ts.isNamedExports(node.exportClause)) {
      node.exportClause.elements.forEach((exportSpecifier) => {
        const exportedSymbolName = String((exportSpecifier.name as ts.Identifier).escapedText);
        updateAvailableExports(exportedSymbolName, availableExports, elements)
      });
    }
    return;
  }

  ts.forEachChild(node, visitor.bind(this, availableExports, node, elements))
}

function sensesPushExportDependencies(
  availableExports: IAvailableExports,
  parent: ts.Node,
  elements: ts.ExportSpecifier[],
) {
  const elementsAsString = elements && elements.map(exportSpecifier => String(exportSpecifier.name.escapedText));

  if (
    ts.isClassDeclaration(parent) ||
    ts.isInterfaceDeclaration(parent) ||
    ts.isEnumDeclaration(parent) ||
    ts.isFunctionDeclaration(parent)
  ) {
    const exportedSymbolName = String((parent.name as ts.Identifier).escapedText);
    updateAvailableExports(exportedSymbolName, availableExports, elements)
  }

  if (ts.isVariableStatement(parent)) {
    parent.declarationList.declarations.forEach((variableDeclaration) => {
      if (ts.isIdentifier(variableDeclaration.name)) {
        const exportedSymbolName = String(variableDeclaration.name.escapedText);
        updateAvailableExports(exportedSymbolName, availableExports, elements)
      }

      // export const { a, b: bAlias } = myObj
      if (ts.isObjectBindingPattern(variableDeclaration.name)) {
        variableDeclaration.name.elements.forEach((bindingElement) => {
          if (ts.isIdentifier(bindingElement.name)) {
            const exportedSymbolName = String(bindingElement.name.escapedText);
            updateAvailableExports(exportedSymbolName, availableExports, elements)
          }
        });
      }
    });
  }
}

function updateAvailableExports(symbolName: string, availableExports: IAvailableExports, elements: ts.ExportSpecifier[]) {
  let shouldAdd = true;
  const elementsAsString = elements && elements.map(exportSpecifier => String(exportSpecifier.name.escapedText));
  if(elements && !elementsAsString.includes(symbolName)) {
    shouldAdd = false;
  }

  if(shouldAdd) {
    if(availableExports[symbolName]) {

    } else {
      availableExports[symbolName] = [{
        originalLocation: '',
        reExportPath: []
      }]
    }
  }
}

getAvailableExports('/Users/patricksevat/WebstormProjects/ts-ast-playground/src/senses.ts')

interface IAvailableExport {
  originalLocation: string,
  reExportPath: string[],
}

interface IAvailableExports {
  [exportedSymbol: string]: IAvailableExport[]
}
