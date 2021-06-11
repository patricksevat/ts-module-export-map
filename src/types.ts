import * as ts from 'typescript';

export interface IContext {
  compilerHost: ts.CompilerHost,
  program: ts.Program,
  sourceFile: ts.SourceFile,
  sourceFilePath: string,
  typeChecker: ts.TypeChecker,
  availableExports: IAvailableExports,
  exports: Record<string, string[]>,
  topLevelExports: string[],
}

export interface ISourceFileWithExports {
  sourceFile: ts.SourceFile,
  exports: string[],
}

export interface IAvailableExport {
  originalLocation: string,
  reExportPath: string[],
  kind: string,
}

export interface IAvailableExports {
  [exportedSymbol: string]: IAvailableExport
}
