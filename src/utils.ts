import * as ts from 'typescript';
import { IAvailableExports, IContext, ISourceFileWithExports } from './types';
import * as fs from "fs";
import * as path from 'path';
import * as util from 'util';

export function replaceQuotes(str: string) {
  return str.replace(/["']/g, '')
}

export function findSourceFile(filePath: string, program: ts.Program): ts.SourceFile {
  return program.getSourceFile(filePath) ||
    program.getSourceFile(`${filePath}.ts`) ||
    program.getSourceFile(`${filePath}/index.ts`) ||
    null
}

export function getCompilerOptions(tsConfigJsonPath: string) {
  if(!tsConfigJsonPath) {
    return {}
  }

  const configTxt = fs.readFileSync(path.resolve(process.cwd(), tsConfigJsonPath), 'utf8');
  const { config } = ts.parseConfigFileTextToJson(tsConfigJsonPath, configTxt);
  return (config && config.compilerOptions) ? config.compilerOptions : {};
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

export function getExportsFromReExports(reExports: ISourceFileWithExports[]) {
  return reExports.reduce((aggregator, sourceFileWithContext) => {
    aggregator[String(sourceFileWithContext.sourceFile.fileName)] = sourceFileWithContext.exports;
    return aggregator;
  }, {})
}

export async function writeOutputToJson(jsonPath: string, results: IAvailableExports) {
  const writeFilePromisified = util.promisify(fs.writeFile);
  await writeFilePromisified(path.resolve(process.cwd(), jsonPath), JSON.stringify(results, null, 2));
}
