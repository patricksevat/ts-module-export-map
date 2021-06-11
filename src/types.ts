import * as ts from 'typescript';

export interface IContext {
  compilerHost: ts.CompilerHost,
  program: ts.Program,
  sourceFile: ts.SourceFile,
  sourceFilePath: string,
  typeChecker: ts.TypeChecker,
  availableExports: IAvailableExports,
  elements: ts.ExportSpecifier[],
  exports: Record<string, string[]>
}

export interface ISourceFileWithExports {
  sourceFile: ts.SourceFile,
  elements: ts.ExportSpecifier[],
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
