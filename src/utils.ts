import * as ts from 'typescript';
import { IAvailableExports, IContext, ISourceFileWithExports } from './types';
import * as fs from "fs";
import * as path from 'path';
import * as util from 'util';
import { ExportDeclaration } from 'typescript';

export function replaceQuotes(str: string) {
  return str.replace(/["']/g, '')
}

export function findSourceFile(filePath: string, program: ts.Program): ts.SourceFile {
  return program.getSourceFile(filePath) ||
    program.getSourceFile(`${filePath}.ts`) ||
    program.getSourceFile(`${filePath}.tsx`) ||
    program.getSourceFile(`${filePath}/index.ts`) ||
    program.getSourceFile(`${filePath}/index.tsx`) ||
    null
}

export function getCompilerOptions(tsConfigJsonPath: string) {
  if(!tsConfigJsonPath) {
    return {}
  }

  const configTxt = fs.readFileSync(path.resolve(process.cwd(), tsConfigJsonPath), 'utf8');
  const { config } = ts.parseConfigFileTextToJson(tsConfigJsonPath, configTxt);
  if(config && config.compilerOptions) {
    return {
      ...config.compilerOptions,
      jsx: ts.JsxEmit.React
    }
  }
  return (config && config.compilerOptions) ? config.compilerOptions : {
    jsx: ts.JsxEmit.React
  };
}

export function createProgramForEntryFile(entryFilePath: string, compilerOptions: ts.CompilerOptions, host: ts.CompilerHost) {
  const compilerOpts = {
    ...compilerOptions,
    moduleResolution: ts.ModuleResolutionKind.NodeJs
  };
  const rootFiles = [entryFilePath];
  return ts.createProgram(rootFiles, compilerOpts, host);
}

export function getAbsoluteModulePathFromExportDeclaration(context: IContext, node: ts.ExportDeclaration) {
  const moduleName = replaceQuotes(node.moduleSpecifier.getText(context.sourceFile));
  const resolvedModule = ts.resolveModuleName(moduleName, context.sourceFile.fileName, context.program.getCompilerOptions(), context.compilerHost)
  if(resolvedModule && resolvedModule.resolvedModule) {
    return resolvedModule.resolvedModule.resolvedFileName;
  }

  return null;
}

export function getExportedIdentifiersFromExportDeclaration(context: IContext, exportDecl: ts.ExportDeclaration): string[] {
  const moduleSymbol = context.typeChecker.getSymbolAtLocation(exportDecl.moduleSpecifier);

  // We are reExporting from a different module e.g.
  // export { symbol } from './other-module'
  if(moduleSymbol) {
    const exports = moduleSymbol && context.typeChecker.getExportsOfModule(moduleSymbol);
    return exports ? exports.map(e => String(e.escapedName)) : null;
  // We are exporting from this module e.g.
  // const bar = 1;
  // export { bar };
  } else if(exportDecl.exportClause) {
    return getNamedExports(exportDecl.exportClause);
  } else {
    return null
  }
}

export function getTopLevelExports(context: IContext, reExportDeclarations: ts.ExportDeclaration[], reExportedSourceFiles: ISourceFileWithExports[]): string[] {
  const availableReExports = reExportDeclarations.reduce((aggr, exportDeclaration ) => {
    const namedReExports = exportDeclaration.exportClause && getNamedExports(exportDeclaration.exportClause);
    if(namedReExports) {
      return [...aggr, ...namedReExports];
    }

    const sourceFileWithExports = reExportedSourceFiles.find(sourceFileWithExports => {
      return sourceFileWithExports.moduleSpecifier === replaceQuotes(exportDeclaration.moduleSpecifier.getText(context.sourceFile))
    });

    const exportsFromSourceFile = sourceFileWithExports.exports || [];
    return [...aggr, ...exportsFromSourceFile];
  }, [])

  return availableReExports
}

export async function writeOutputToJson(jsonPath: string, results: IAvailableExports) {
  const writeFilePromisified = util.promisify(fs.writeFile);
  await writeFilePromisified(path.resolve(process.cwd(), jsonPath), JSON.stringify(results, null, 2));
}

export function getNamedExports(namedExports: ts.NamedExports): string[] {
  return namedExports.elements.map((exportSpecifier) => {
    return String(exportSpecifier.name.escapedText)
  })
}

export function getModuleNameFromExportDeclaration(context: IContext, exportDeclaration: ExportDeclaration): string {
  const moduleSpecifier = exportDeclaration.moduleSpecifier;

  if(!moduleSpecifier) {
    return null;
  }

  return replaceQuotes(exportDeclaration.moduleSpecifier.getText(context.sourceFile))
}
