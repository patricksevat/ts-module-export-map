import * as ts from 'typescript';
import { IContext, ISourceFileWithExports } from './types';

export function replaceQuotes(str: string) {
  return str.replace(/["']/g, '')
}

export function findSourceFile(filePath: string, program: ts.Program): ts.SourceFile {
  return program.getSourceFile(filePath) ||
    program.getSourceFile(`${filePath}.ts`) ||
    program.getSourceFile(`${filePath}/index.ts`) ||
    null
}

export function createProgramForEntryFile(entryFilePath: string) {
  const compilerOpts = { moduleResolution: ts.ModuleResolutionKind.NodeJs };
  const rootFiles = [entryFilePath];
  return ts.createProgram(rootFiles, compilerOpts);
}

export function getAbsoluteModulePathFromExportDeclaration(context: IContext, node: ts.ExportDeclaration) {
  const moduleName = replaceQuotes(node.moduleSpecifier.getText(context.sourceFile));
  // @ts-ignore
  const resolvedModule = context.program.getResolvedModuleWithFailedLookupLocationsFromCache(moduleName, context.sourceFile.fileName)
  if(resolvedModule && resolvedModule.resolvedModule) {
    return resolvedModule.resolvedModule.resolvedFileName;
  }

  return null;
}

export function getExportsFromReExports(reExports: ISourceFileWithExports[]) {
  return reExports.reduce((aggregator, sourceFileWithContext) => {
    aggregator[String(sourceFileWithContext.sourceFile.fileName)] = sourceFileWithContext.exports;
    return aggregator;
  }, {})
}
