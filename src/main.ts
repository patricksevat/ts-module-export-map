import * as ts from 'typescript';
import {
  createProgramForEntryFile,
  findSourceFile,
  getAbsoluteModulePathFromExportDeclaration,
  getExportsFromReExports,
} from './utils';
import { visitor } from './visitor';
import { IAvailableExports, IContext, ISourceFileWithExports } from './types';

function getAvailableExports(entryFilePath: string) {
  const program = createProgramForEntryFile(entryFilePath);
  const entrySourceFile = program.getSourceFile(entryFilePath);
  const results = processSourceFile(entrySourceFile, program);

  console.log(JSON.stringify(results, null, 2))
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
  const context = {
    program,
    sourceFile,
    sourceFilePath: sourceFile.fileName.replace(process.cwd(), ''),
    typeChecker: program.getTypeChecker(),
    availableExports,
    elements,
    exports: null,
  }

  const reExportDeclarations = sourceFile.statements.filter(ts.isExportDeclaration).filter(exportDecl => exportDecl.moduleSpecifier);
  const reExportedSourceFiles = getSourceFilesForReExportedModules(context, reExportDeclarations);
  context.exports = getExportsFromReExports(reExportedSourceFiles);

  findExportsInSourceFile(context);

  reExportedSourceFiles.forEach((childSourceFileWithElements) => {
    const { sourceFile: childSourceFile, elements: childElements } = childSourceFileWithElements;
    processSourceFile(childSourceFile, program, availableExports, childElements)
  })

  return availableExports;
}

function findExportsInSourceFile(context: IContext): void {
  ts.forEachChild(context.sourceFile, visitor.bind(context, null,));
}

function getSourceFilesForReExportedModules(
  context: IContext,
  exportDeclarations: ts.ExportDeclaration[],
): ISourceFileWithExports[] {
  const sourceFiles = [];

  exportDeclarations.forEach((exportDecl) => {
    const fileName = getAbsoluteModulePathFromExportDeclaration(context, exportDecl);

    // elements works when explicitly exporting such as `export { foo, bar } from './module`
    const elements = exportDecl.exportClause && exportDecl.exportClause.elements ? exportDecl.exportClause.elements : null;

    // exports moduleSymbol works when wildcard exporting such as `export * from './module`
    const moduleSymbol = context.typeChecker.getSymbolAtLocation(exportDecl.moduleSpecifier);
    const exports = moduleSymbol && context.typeChecker.getExportsOfModule(moduleSymbol);
    const exportsAsString = exports ? exports.map(e => String(e.escapedName)) : null;

    const newSourceFile = findSourceFile(fileName, context.program);
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

getAvailableExports('/Users/patricksevat/WebstormProjects/ts-ast-playground/src/test/entry.ts')
