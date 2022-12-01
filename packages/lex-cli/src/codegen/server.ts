import {
  IndentationText,
  Project,
  SourceFile,
  VariableDeclarationKind,
} from 'ts-morph'
import {
  Lexicons,
  LexiconDoc,
  LexXrpcProcedure,
  LexXrpcQuery,
  LexRecord,
} from '@atproto/lexicon'
import { NSID } from '@atproto/nsid'
import { gen, lexiconsTs } from './common'
import { GeneratedAPI } from '../types'
import {
  genImports,
  genUserType,
  genObject,
  genXrpcParams,
  genXrpcInput,
  genXrpcOutput,
} from './lex-gen'
import {
  lexiconsToDefTree,
  DefTreeNode,
  schemasToNsidTokens,
  toCamelCase,
  toTitleCase,
  toScreamingSnakeCase,
} from './util'

export async function genServerApi(
  lexiconDocs: LexiconDoc[],
): Promise<GeneratedAPI> {
  const project = new Project({
    useInMemoryFileSystem: true,
    manipulationSettings: { indentationText: IndentationText.TwoSpaces },
  })
  const api: GeneratedAPI = { files: [] }
  const lexicons = new Lexicons(lexiconDocs)
  const nsidTree = lexiconsToDefTree(lexiconDocs)
  const nsidTokens = schemasToNsidTokens(lexiconDocs)
  for (const lexiconDoc of lexiconDocs) {
    api.files.push(await lexiconTs(project, lexicons, lexiconDoc))
  }
  api.files.push(await lexiconsTs(project, lexiconDocs))
  api.files.push(await indexTs(project, lexiconDocs, nsidTree, nsidTokens))
  return api
}

const indexTs = (
  project: Project,
  lexiconDocs: LexiconDoc[],
  nsidTree: DefTreeNode[],
  nsidTokens: Record<string, string[]>,
) =>
  gen(project, '/index.ts', async (file) => {
    //= import {createServer as createXrpcServer, Server as XrpcServer} from '@atproto/xrpc-server'
    const xrpcImport = file.addImportDeclaration({
      moduleSpecifier: '@atproto/xrpc-server',
    })
    xrpcImport.addNamedImport({
      name: 'createServer',
      alias: 'createXrpcServer',
    })
    xrpcImport.addNamedImport({
      name: 'Server',
      alias: 'XrpcServer',
    })
    xrpcImport.addNamedImport({
      name: 'Options',
      alias: 'XrpcOptions',
    })
    //= import {lexicons} from './lexicons'
    file
      .addImportDeclaration({
        moduleSpecifier: './lexicons',
      })
      .addNamedImport({
        name: 'lexicons',
      })

    // generate type imports
    for (const lexiconDoc of lexiconDocs) {
      if (
        lexiconDoc.defs.main?.type !== 'query' &&
        lexiconDoc.defs.main?.type !== 'procedure'
      ) {
        continue
      }
      file
        .addImportDeclaration({
          moduleSpecifier: `./types/${lexiconDoc.id.split('.').join('/')}`,
        })
        .setNamespaceImport(toTitleCase(lexiconDoc.id))
    }

    // generate token enums
    for (const nsidAuthority in nsidTokens) {
      // export const {THE_AUTHORITY} = {
      //  {Name}: "{authority.the.name}"
      // }
      file.addVariableStatement({
        isExported: true,
        declarationKind: VariableDeclarationKind.Const,
        declarations: [
          {
            name: toScreamingSnakeCase(nsidAuthority),
            initializer: [
              '{',
              ...nsidTokens[nsidAuthority].map(
                (nsidName) =>
                  `${toTitleCase(nsidName)}: "${nsidAuthority}.${nsidName}",`,
              ),
              '}',
            ].join('\n'),
          },
        ],
      })
    }

    //= export function createServer(options?: XrpcOptions) { ... }
    const createServerFn = file.addFunction({
      name: 'createServer',
      returnType: 'Server',
      parameters: [
        { name: 'options', type: 'XrpcOptions', hasQuestionToken: true },
      ],
      isExported: true,
    })
    createServerFn.setBodyText(`return new Server(options)`)

    //= export class Server {...}
    const serverCls = file.addClass({
      name: 'Server',
      isExported: true,
    })
    //= xrpc: XrpcServer = createXrpcServer(methodSchemas)
    serverCls.addProperty({
      name: 'xrpc',
      type: 'XrpcServer',
    })

    // generate classes for the schemas
    for (const ns of nsidTree) {
      //= ns: NS
      serverCls.addProperty({
        name: ns.propName,
        type: ns.className,
      })

      // class...
      genNamespaceCls(file, ns)
    }

    //= constructor (options?: XrpcOptions) {
    //=  this.xrpc = createXrpcServer(lexicons, options)
    //=  {namespace declarations}
    //= }
    serverCls
      .addConstructor({
        parameters: [
          { name: 'options', type: 'XrpcOptions', hasQuestionToken: true },
        ],
      })
      .setBodyText(
        [
          'this.xrpc = createXrpcServer(lexicons, options)',
          ...nsidTree.map(
            (ns) => `this.${ns.propName} = new ${ns.className}(this)`,
          ),
        ].join('\n'),
      )
  })

function genNamespaceCls(file: SourceFile, ns: DefTreeNode) {
  //= export class {ns}NS {...}
  const cls = file.addClass({
    name: ns.className,
    isExported: true,
  })
  //= _server: Server
  cls.addProperty({
    name: '_server',
    type: 'Server',
  })

  for (const child of ns.children) {
    //= child: ChildNS
    cls.addProperty({
      name: child.propName,
      type: child.className,
    })

    // recurse
    genNamespaceCls(file, child)
  }

  //= constructor(server: Server) {
  //=  this._server = server
  //=  {child namespace declarations}
  //= }
  const cons = cls.addConstructor()
  cons.addParameter({
    name: 'server',
    type: 'Server',
  })
  cons.setBodyText(
    [
      `this._server = server`,
      ...ns.children.map(
        (ns) => `this.${ns.propName} = new ${ns.className}(server)`,
      ),
    ].join('\n'),
  )

  // methods
  for (const userType of ns.userTypes) {
    if (userType.def.type !== 'query' && userType.def.type !== 'procedure') {
      continue
    }
    const moduleName = toTitleCase(userType.nsid)
    const name = toCamelCase(NSID.parse(userType.nsid).name || '')
    const method = cls.addMethod({
      name,
    })
    method.addParameter({
      name: 'handler',
      type: `${moduleName}.Handler`,
    })
    method.setBodyText(
      [
        // Placing schema on separate line, since the following one was being formatted
        // into multiple lines and causing the ts-ignore to ignore the wrong line.
        `const schema = '${userType.nsid}' // @ts-ignore`,
        `return this._server.xrpc.method(schema, handler)`,
      ].join('\n'),
    )
  }
}

const lexiconTs = (project, lexicons: Lexicons, lexiconDoc: LexiconDoc) =>
  gen(
    project,
    `/types/${lexiconDoc.id.split('.').join('/')}.ts`,
    async (file) => {
      const imports: Set<string> = new Set()

      const main = lexiconDoc.defs.main
      if (main?.type === 'query' || main?.type === 'procedure') {
        //= import express from 'express'
        file.addImportDeclaration({
          moduleSpecifier: 'express',
          defaultImport: 'express',
        })
      }

      for (const defId in lexiconDoc.defs) {
        const def = lexiconDoc.defs[defId]
        const lexUri = `${lexiconDoc.id}#${defId}`
        if (defId === 'main') {
          if (def.type === 'query' || def.type === 'procedure') {
            genXrpcParams(file, lexicons, lexUri)
            genXrpcInput(file, imports, lexicons, lexUri)
            genXrpcOutput(file, imports, lexicons, lexUri)
            genServerXrpcCommon(file, lexicons, lexUri)
          } else if (def.type === 'record') {
            genServerRecord(file, imports, lexicons, lexUri)
          } else {
            genUserType(file, imports, lexicons, lexUri)
          }
        } else {
          genUserType(file, imports, lexicons, lexUri)
        }
      }
      genImports(file, imports, lexiconDoc.id)
    },
  )

function genServerXrpcCommon(
  file: SourceFile,
  lexicons: Lexicons,
  lexUri: string,
) {
  const def = lexicons.getDefOrThrow(lexUri, ['query', 'procedure']) as
    | LexXrpcQuery
    | LexXrpcProcedure

  //= export interface HandlerInput {...}
  if (def.type === 'procedure' && def.input?.encoding) {
    const handlerInput = file.addInterface({
      name: 'HandlerInput',
      isExported: true,
    })

    if (Array.isArray(def.input.encoding)) {
      handlerInput.addProperty({
        name: 'encoding',
        type: def.input.encoding.map((v) => `'${v}'`).join(' | '),
      })
    } else if (typeof def.input.encoding === 'string') {
      handlerInput.addProperty({
        name: 'encoding',
        type: `'${def.input.encoding}'`,
      })
    }
    if (def.input.schema) {
      if (Array.isArray(def.input.encoding)) {
        handlerInput.addProperty({
          name: 'body',
          type: 'InputSchema | Uint8Array',
        })
      } else {
        handlerInput.addProperty({ name: 'body', type: 'InputSchema' })
      }
    } else if (def.input.encoding) {
      handlerInput.addProperty({ name: 'body', type: 'Uint8Array' })
    }
  } else {
    file.addTypeAlias({
      isExported: true,
      name: 'HandlerInput',
      type: 'undefined',
    })
  }

  // export interface HandlerSuccess {...}
  let hasHandlerSuccess = false
  if (def.output?.schema || def.output?.encoding) {
    hasHandlerSuccess = true
    const handlerSuccess = file.addInterface({
      name: 'HandlerSuccess',
      isExported: true,
    })
    if (Array.isArray(def.output.encoding)) {
      handlerSuccess.addProperty({
        name: 'encoding',
        type: def.output.encoding.map((v) => `'${v}'`).join(' | '),
      })
    } else if (typeof def.output.encoding === 'string') {
      handlerSuccess.addProperty({
        name: 'encoding',
        type: `'${def.output.encoding}'`,
      })
    }
    if (def.output?.schema) {
      if (Array.isArray(def.output.encoding)) {
        handlerSuccess.addProperty({
          name: 'body',
          type: 'OutputSchema | Uint8Array',
        })
      } else {
        handlerSuccess.addProperty({ name: 'body', type: 'OutputSchema' })
      }
    } else if (def.output?.encoding) {
      handlerSuccess.addProperty({ name: 'body', type: 'Uint8Array' })
    }
  }

  // export interface HandlerError {...}
  const handlerError = file.addInterface({
    name: 'HandlerError',
    isExported: true,
  })
  handlerError.addProperties([
    { name: 'status', type: 'number' },
    { name: 'message?', type: 'string' },
  ])
  if (def.errors?.length) {
    handlerError.addProperty({
      name: 'error?',
      type: def.errors.map((err) => `'${err.name}'`).join(' | '),
    })
  }

  // export type HandlerOutput = ...
  file.addTypeAlias({
    isExported: true,
    name: 'HandlerOutput',
    type: `HandlerError | ${hasHandlerSuccess ? 'HandlerSuccess' : 'void'}`,
  })

  file.addTypeAlias({
    name: 'Handler',
    isExported: true,
    type: `(
        params: QueryParams,
        input: HandlerInput,
        req: express.Request,
        res: express.Response,
      ) => Promise<HandlerOutput> | HandlerOutput`,
  })
}

function genServerRecord(
  file: SourceFile,
  imports: Set<string>,
  lexicons: Lexicons,
  lexUri: string,
) {
  const def = lexicons.getDefOrThrow(lexUri, ['record']) as LexRecord

  //= export interface Record {...}
  genObject(file, imports, lexUri, def.record, 'Record')
}