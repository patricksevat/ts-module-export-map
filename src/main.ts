#!/usr/bin/env ts-node

import * as ts from 'typescript';
import * as yargs from 'yargs';
import {
  createProgramForEntryFile,
  findSourceFile,
  getAbsoluteModulePathFromExportDeclaration,
  getCompilerOptions,
  getExportedIdentifiersFromExportDeclaration,
  getTopLevelExports, replaceQuotes,
  writeOutputToJson,
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
  return processSourceFile(entrySourceFile, program, compilerHost);
}

/**
 * @param sourceFile
 * @param program
 * @param compilerHost
 * @param availableExports
 * `availableExports` is the aggregate object which collects all exports, the file they are originally declared in,
 * and the re-export path which shows all the files which have exported this symbol
 * @param exportsAvailableFromEntryFile
 * all exported symbols available in the ENTRY file. We keep track because we can later filter out any identifiers that
 * are not re-exported by any of the intermediate files
 */
function processSourceFile(sourceFile: ts.SourceFile, program: ts.Program, compilerHost: ts.CompilerHost, availableExports: IAvailableExports = {}, exportsAvailableFromEntryFile: string[] = null) {
  const context: IContext = {
    program,
    compilerHost,
    sourceFile,
    sourceFilePath: sourceFile.fileName.replace(process.cwd(), ''),
    typeChecker: program.getTypeChecker(),
    availableExports,
    exportsAvailableFromEntryFile,
    isEntryFile: !Boolean(exportsAvailableFromEntryFile),
  }

  const reExportDeclarations = sourceFile.statements.filter(ts.isExportDeclaration).filter(exportDecl => exportDecl.moduleSpecifier);
  const reExportedSourceFiles = getSourceFilesForReExportedModules(context, reExportDeclarations);

  context.exportsAvailableFromEntryFile = exportsAvailableFromEntryFile || getTopLevelExports(context, reExportDeclarations, reExportedSourceFiles);

  findExportsInSourceFile(context);

  reExportedSourceFiles.forEach((childSourceFileWithExports) => {
    const { sourceFile: childSourceFile } = childSourceFileWithExports;
    processSourceFile(childSourceFile, program, compilerHost, availableExports, context.exportsAvailableFromEntryFile)
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

    // Gives us all exported identifiers for this exportDeclaration
    // the identifiers can be explicit ['foo', 'bar'] in `export { foo, bar } from './module'`
    // and also implicit ['foo', 'bar', 'baz'] in `export * from './module'
    const exportedIdentifiers = getExportedIdentifiersFromExportDeclaration(context, exportDecl)

    const newSourceFile = findSourceFile(fileName, context.program);
    if (newSourceFile) {
      sourceFiles.push({
        moduleSpecifier: replaceQuotes(exportDecl.moduleSpecifier.getText(context.sourceFile)),
        sourceFile: newSourceFile,
        exports: exportedIdentifiers,
      });
    }
  })

  return sourceFiles;
}

async function parseCmdLineArgs() {
  argv = await yargs(process.argv.slice(2)).options({
    tsConfigJson: { type: 'string', default: '' },
    outputJson: { type: 'string', default: null },
    silent: { type: 'boolean', default: false }
  }).argv
}

async function processResults(results: IAvailableExports) {
  if(argv.outputJson) {
    await writeOutputToJson(argv.outputJson, results)
  }
  if(!argv.silent) {
    console.log(JSON.stringify(results, null, 2))
  }
}

parseCmdLineArgs()
  .then(getAvailableExports)
  .then(processResults)
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
