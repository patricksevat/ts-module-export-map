import * as ts from 'typescript';
import { getAbsoluteModulePathFromExportDeclaration, replaceQuotes } from './utils';
import { IContext } from './types';

export function visitor(
  parent: ts.Node,
  node: ts.Node) {
  const context: IContext = this;

  // export const foo = 'a'
  if (node.kind === ts.SyntaxKind.ExportKeyword) {
    sensesPushExportDependencies(context, parent);
    return;

  } else if (ts.isExportDeclaration(node)) {
    // const foo = 'a';
    // export { foo, foo as fooAlias }
    if (node.exportClause && ts.isNamedExports(node.exportClause)) {
      node.exportClause.elements.forEach((exportSpecifier) => {
        // this.typeChecker.getSymbolAtLocation(exportSpecifier.name)
        const exportedSymbolName = String((exportSpecifier.name as ts.Identifier).escapedText);
        updateAvailableExports(context, exportedSymbolName)
      });
    } else {
      // export * from './module'
      const absoluteModulePath = getAbsoluteModulePathFromExportDeclaration(context, node);
      if(absoluteModulePath) {
        const exportsFromModule = absoluteModulePath && this.exports[absoluteModulePath];

        exportsFromModule && exportsFromModule.forEach((exportedSymbolName: string) => {
          updateAvailableExports(context, exportedSymbolName)
        })
      }
    }
    return;
  }

  ts.forEachChild(node, visitor.bind(this, node))
}


function sensesPushExportDependencies(
  context: IContext,
  parent: ts.Node,
) {
  if (
    ts.isClassDeclaration(parent) ||
    ts.isInterfaceDeclaration(parent) ||
    ts.isEnumDeclaration(parent) ||
    ts.isFunctionDeclaration(parent)
  ) {
    const exportedSymbolName = String((parent.name as ts.Identifier).escapedText);
    updateAvailableExports(context, exportedSymbolName)
  }

  if (ts.isVariableStatement(parent)) {
    parent.declarationList.declarations.forEach((variableDeclaration) => {
      if (ts.isIdentifier(variableDeclaration.name)) {
        const exportedSymbolName = String(variableDeclaration.name.escapedText);
        updateAvailableExports(context, exportedSymbolName)
      }

      // export const { a, b: bAlias } = myObj
      if (ts.isObjectBindingPattern(variableDeclaration.name)) {
        variableDeclaration.name.elements.forEach((bindingElement) => {
          if (ts.isIdentifier(bindingElement.name)) {
            const exportedSymbolName = String(bindingElement.name.escapedText);
            updateAvailableExports(context, exportedSymbolName)
          }
        });
      }
    });
  }
}

function updateAvailableExports(context: IContext, symbolName: string) {
  let shouldAdd = true;
  const elementsAsString = context.elements && context.elements.map(exportSpecifier => String(exportSpecifier.name.escapedText));
  if(context.elements && !elementsAsString.includes(symbolName)) {
    shouldAdd = false;
  }

  if(shouldAdd) {
    if(context.availableExports[symbolName]) {
      context.availableExports[symbolName].originalLocation = context.sourceFilePath;
      if(!context.availableExports[symbolName].reExportPath.includes(context.sourceFilePath)) {
        context.availableExports[symbolName].reExportPath.push(context.sourceFilePath)
      }
    } else {
      context.availableExports[symbolName] = {
        originalLocation: context.sourceFilePath,
        reExportPath: [context.sourceFilePath]
      }
    }
  }
}
