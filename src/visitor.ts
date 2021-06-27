import * as ts from 'typescript';
import { getExportedIdentifiersFromExportDeclaration, getModuleNameFromExportDeclaration } from './utils';
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
    const moduleName = getModuleNameFromExportDeclaration(context, node)
    const exportedIdentifiers = getExportedIdentifiersFromExportDeclaration(context, node) || [];
    exportedIdentifiers.forEach(identifier => {
      // nodeKind will be set once we process the sourceFile that actually declares the identifier
      updateAvailableExports(context, identifier, null, moduleName)
    })

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
    updateAvailableExports(context, exportedSymbolName, parent.kind, null)
  }

  if (ts.isVariableStatement(parent)) {
    parent.declarationList.declarations.forEach((variableDeclaration) => {
      if (ts.isIdentifier(variableDeclaration.name)) {
        const exportedSymbolName = String(variableDeclaration.name.escapedText);
        updateAvailableExports(context, exportedSymbolName, parent.kind, null)
      }

      // export const { a, b: bAlias } = myObj
      if (ts.isObjectBindingPattern(variableDeclaration.name)) {
        variableDeclaration.name.elements.forEach((bindingElement) => {
          if (ts.isIdentifier(bindingElement.name)) {
            const exportedSymbolName = String(bindingElement.name.escapedText);
            updateAvailableExports(context, exportedSymbolName, parent.kind, null)
          }
        });
      }
    });
  }
}

function updateAvailableExports(context: IContext, symbolName: string, nodeKind: ts.SyntaxKind, moduleName: string) {
  // Check for moduleSpecifier in entryFile
  // export { foo, bar } from 'other-module'
  // should be handled differently from local exportDeclarations:
  // const foo = 'a'; export { foo };
  if(context.isEntryFile && moduleName && context.exportsAvailableFromEntryFile && !context.exportsAvailableFromEntryFile.includes(symbolName)) {
    return;
  }

  // In non-entry files we only want to return stuff thats available in the entry file
  if(!context.isEntryFile && context.exportsAvailableFromEntryFile && !context.exportsAvailableFromEntryFile.includes(symbolName)) {
    return
  }

  if(context.availableExports[symbolName]) {
    context.availableExports[symbolName].originalLocation = context.sourceFilePath;
    context.availableExports[symbolName].kind = nodeKind ? ts.SyntaxKind[nodeKind] : context.availableExports[symbolName].kind
    if(!context.availableExports[symbolName].reExportPath.includes(context.sourceFilePath)) {
      context.availableExports[symbolName].reExportPath.push(context.sourceFilePath)
    }
  } else {
    context.availableExports[symbolName] = {
      originalLocation: context.sourceFilePath,
      reExportPath: [context.sourceFilePath],
      kind: nodeKind ? ts.SyntaxKind[nodeKind] : ''
    }
  }
}
