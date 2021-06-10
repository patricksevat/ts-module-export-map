import * as ts from 'typescript';
import * as path from 'path';
import * as util from 'util';

function getAvailableExports(entryFilePath: string) {
  const program = createProgramForEntryFile(entryFilePath);
  const entrySourceFile = program.getSourceFile(entryFilePath);
  const results = processSourceFile(entrySourceFile, program);

  console.log(util.inspect(results, false, 3, true))
}

function createProgramForEntryFile(entryFilePath: string) {
  const compilerOpts = { moduleResolution: ts.ModuleResolutionKind.NodeJs };
  const rootFiles = [entryFilePath];
  return ts.createProgram(rootFiles, compilerOpts);
}

/**
 * @param sourceFile
 * @param program
 * @param availableExports
 * `availableExports` is the aggregate object which collects all exports, the file they are originally declared in,
 * and the re-export path which shows all the files which have exported this symbol
 * @param elements
 * `elements` are named reexports such as: export { foo, bar } from './other-module'
 */
function processSourceFile(sourceFile: ts.SourceFile, program: ts.Program, availableExports: IAvailableExports = {}, elements: ts.ExportSpecifier[] = null) {
  const reExportDeclarations = sourceFile.statements.filter(ts.isExportDeclaration).filter(exportDecl => exportDecl.moduleSpecifier);
  const reExportedSourceFiles = getSourceFilesForReExportedModules(reExportDeclarations, sourceFile, program);
  const exportsFromImportedModules = reExportedSourceFiles.reduce((aggregator, sourceFileWithContext) => {
    aggregator[String(sourceFileWithContext.sourceFile.fileName)] = sourceFileWithContext.exports;
    return aggregator;
  }, {})
  const typeChecker = program.getTypeChecker();
  const sourceFilePath = sourceFile.fileName.replace('/Users/patricksevat/WebstormProjects/ts-ast-playground', '');

  findExportsInSourceFile({
    program,
    sourceFile,
    sourceFilePath,
    typeChecker,
    availableExports,
    elements,
    exports: exportsFromImportedModules,
  });

  reExportedSourceFiles.forEach((childSourceFileWithElements) => {
    const { sourceFile: childSourceFile, elements: childElements } = childSourceFileWithElements;
    processSourceFile(childSourceFile, program, availableExports, childElements)
  })

  return availableExports;
}

interface IContext {
  program: ts.Program,
  sourceFile: ts.SourceFile,
  sourceFilePath: string,
  typeChecker: ts.TypeChecker,
  availableExports: IAvailableExports,
  elements: ts.ExportSpecifier[],
  exports: Record<string, string[]>
}
function findExportsInSourceFile(context: IContext): void {
  ts.forEachChild(context.sourceFile, visitor.bind(context, null,));
}

interface ISourceFileWithElements {
  sourceFile: ts.SourceFile,
  elements: ts.ExportSpecifier[],
  exports: string[],
}

function getSourceFilesForReExportedModules(
  exportDeclarations: ts.ExportDeclaration[],
  currentSourceFile: ts.SourceFile,
  program: ts.Program
): ISourceFileWithElements[] {
  const sourceFiles = [];
  const checker = program.getTypeChecker();

  exportDeclarations.forEach((exportDecl) => {
    const moduleSpecifier = exportDecl.moduleSpecifier;
    const dirName = path.dirname(currentSourceFile.fileName);
    const relativePath = replaceQuotes(moduleSpecifier.getText(currentSourceFile))
    const fileName = path.resolve(dirName, relativePath);

    // elements works when explicitly exporting such as `export { foo, bar } from './module`
    const elements = exportDecl.exportClause && exportDecl.exportClause.elements ? exportDecl.exportClause.elements : null;
    // exports moduleSymbol works when wildcard exporting such as `export * from './module`
    const moduleSymbol = checker.getSymbolAtLocation(exportDecl.moduleSpecifier);
    const exports = moduleSymbol && checker.getExportsOfModule(moduleSymbol);
    const exportsAsString = exports ? exports.map(e => String(e.escapedName)) : null;

    const newSourceFile = findSourceFile(fileName, program);
    if (newSourceFile) {
      sourceFiles.push({
        sourceFile: newSourceFile,
        elements,
        exports: exportsAsString,
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

function visitor(
  parent: ts.Node,
  node: ts.Node) {
  // export const foo = 'a'
  if (node.kind === ts.SyntaxKind.ExportKeyword) {
    sensesPushExportDependencies(this.availableExports, parent, this.elements, this);
    return;

  } else if (ts.isExportDeclaration(node)) {
    // const foo = 'a';
    // export { foo, foo as fooAlias }
    if (node.exportClause && ts.isNamedExports(node.exportClause)) {
      node.exportClause.elements.forEach((exportSpecifier) => {
        // this.typeChecker.getSymbolAtLocation(exportSpecifier.name)
        const exportedSymbolName = String((exportSpecifier.name as ts.Identifier).escapedText);
        updateAvailableExports(exportedSymbolName, this.availableExports, this.elements, this)
      });
    } else {
      // export * from './module'
      const moduleName = replaceQuotes(node.moduleSpecifier.getText(this.sourceFile));
      const resolvedModule = this.program.getResolvedModuleWithFailedLookupLocationsFromCache(moduleName, this.sourceFile.fileName)
      if(resolvedModule && resolvedModule.resolvedModule) {
        const moduleAbsolutePath = resolvedModule.resolvedModule.resolvedFileName;
        const exportsFromModule = moduleAbsolutePath && this.exports[moduleAbsolutePath];

        exportsFromModule && exportsFromModule.forEach((exportedSymbolName: string) => {
          updateAvailableExports(exportedSymbolName, this.availableExports, this.elements, this)
        })
      }
    }
    return;
  }

  ts.forEachChild(node, visitor.bind(this, node))
}

function sensesPushExportDependencies(
  availableExports: IAvailableExports,
  parent: ts.Node,
  elements: ts.ExportSpecifier[],
  context
) {
  if (
    ts.isClassDeclaration(parent) ||
    ts.isInterfaceDeclaration(parent) ||
    ts.isEnumDeclaration(parent) ||
    ts.isFunctionDeclaration(parent)
  ) {
    const exportedSymbolName = String((parent.name as ts.Identifier).escapedText);
    updateAvailableExports(exportedSymbolName, availableExports, elements, context)
  }

  if (ts.isVariableStatement(parent)) {
    parent.declarationList.declarations.forEach((variableDeclaration) => {
      if (ts.isIdentifier(variableDeclaration.name)) {
        const exportedSymbolName = String(variableDeclaration.name.escapedText);
        updateAvailableExports(exportedSymbolName, availableExports, elements, context)
      }

      // export const { a, b: bAlias } = myObj
      if (ts.isObjectBindingPattern(variableDeclaration.name)) {
        variableDeclaration.name.elements.forEach((bindingElement) => {
          if (ts.isIdentifier(bindingElement.name)) {
            const exportedSymbolName = String(bindingElement.name.escapedText);
            updateAvailableExports(exportedSymbolName, availableExports, elements, context)
          }
        });
      }
    });
  }
}

function updateAvailableExports(symbolName: string, availableExports: IAvailableExports, elements: ts.ExportSpecifier[], context: IContext) {
  let shouldAdd = true;
  const elementsAsString = elements && elements.map(exportSpecifier => String(exportSpecifier.name.escapedText));
  if(elements && !elementsAsString.includes(symbolName)) {
    shouldAdd = false;
  }

  if(shouldAdd) {
    if(availableExports[symbolName]) {
      availableExports[symbolName][0].originalLocation = context.sourceFilePath;
      if(!availableExports[symbolName][0].reExportPath.includes(context.sourceFilePath)) {
        availableExports[symbolName][0].reExportPath.push(context.sourceFilePath)
      }
    } else {
      availableExports[symbolName] = [{
        originalLocation: context.sourceFilePath,
        reExportPath: [context.sourceFilePath]
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
