#!/usr/bin/env ts-node

import * as ts from 'typescript';
import * as yargs from 'yargs';
import {
  createProgramForEntryFile,
  findSourceFile,
  getAbsoluteModulePathFromExportDeclaration, getCompilerOptions,
  getExportsFromReExports,
} from './utils';
import { visitor } from './visitor';
import { IAvailableExports, IContext, ISourceFileWithExports } from './types';

let argv;

function getAvailableExports() {
  const entryFilePath = argv._[0];
  const tsConfigJsonPath = argv.tsConfigJson;
  const compilerOptions = getCompilerOptions(tsConfigJsonPath);
  const compilerHost = ts.createCompilerHost(compilerOptions);
  const program = createProgramForEntryFile(entryFilePath, compilerOptions, compilerHost);
  const entrySourceFile = program.getSourceFile(entryFilePath);
  const results = processSourceFile(entrySourceFile, program, compilerHost);

  console.log(JSON.stringify(results, null, 2))
}

/**
 * @param sourceFile
 * @param program
 * @param compilerHost
 * @param availableExports
 * `availableExports` is the aggregate object which collects all exports, the file they are originally declared in,
 * and the re-export path which shows all the files which have exported this symbol
 * @param elements
 * `elements` are named reexports such as: export { foo, bar } from './other-module'
 */
function processSourceFile(sourceFile: ts.SourceFile, program: ts.Program, compilerHost: ts.CompilerHost, availableExports: IAvailableExports = {}, elements: ts.ExportSpecifier[] = null) {
  const context = {
    program,
    compilerHost,
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
    processSourceFile(childSourceFile, program, compilerHost, availableExports, childElements)
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

async function parseCmdLineArgs() {
  argv = await yargs(process.argv.slice(2)).options({
    tsConfigJson: { type: 'string', default: '' }
  }).argv
}

parseCmdLineArgs()
  .then(getAvailableExports)
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
