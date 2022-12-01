import { z } from 'zod'
import { NSID } from '@atproto/nsid'

// primitives
// =

export const lexBoolean = z.object({
  type: z.literal('boolean'),
  description: z.string().optional(),
  default: z.boolean().optional(),
  const: z.boolean().optional(),
})
export type LexBoolean = z.infer<typeof lexBoolean>

export const lexNumber = z.object({
  type: z.literal('number'),
  description: z.string().optional(),
  default: z.number().optional(),
  minimum: z.number().optional(),
  maximum: z.number().optional(),
  enum: z.number().array().optional(),
  const: z.number().optional(),
})
export type LexNumber = z.infer<typeof lexNumber>

export const lexInteger = z.object({
  type: z.literal('integer'),
  description: z.string().optional(),
  default: z.number().int().optional(),
  minimum: z.number().int().optional(),
  maximum: z.number().int().optional(),
  enum: z.number().int().array().optional(),
  const: z.number().int().optional(),
})
export type LexInteger = z.infer<typeof lexInteger>

export const lexString = z.object({
  type: z.literal('string'),
  description: z.string().optional(),
  default: z.string().optional(),
  minLength: z.number().int().optional(),
  maxLength: z.number().int().optional(),
  enum: z.string().array().optional(),
  const: z.string().optional(),
  knownValues: z.string().array().optional(),
})
export type LexString = z.infer<typeof lexString>

export const lexDatetime = z.object({
  type: z.literal('datetime'),
  description: z.string().optional(),
})
export type LexDatetime = z.infer<typeof lexDatetime>

export const lexUnknown = z.object({
  type: z.literal('unknown'),
  description: z.string().optional(),
})
export type LexUnknown = z.infer<typeof lexUnknown>

export const lexPrimitive = z.union([
  lexBoolean,
  lexNumber,
  lexInteger,
  lexString,
  lexDatetime,
  lexUnknown,
])
export type LexPrimitive = z.infer<typeof lexPrimitive>

// blobs
// =

export const lexBlob = z.object({
  type: z.literal('blob'),
  description: z.string().optional(),
  accept: z.string().array().optional(),
  maxSize: z.number().optional(),
})
export type LexBlob = z.infer<typeof lexBlob>

export const lexImage = z.object({
  type: z.literal('image'),
  description: z.string().optional(),
  accept: z.string().array().optional(),
  maxSize: z.number().optional(),
  maxWidth: z.number().int().optional(),
  maxHeight: z.number().int().optional(),
})
export type LexImage = z.infer<typeof lexImage>

export const lexVideo = z.object({
  type: z.literal('video'),
  description: z.string().optional(),
  accept: z.string().array().optional(),
  maxSize: z.number().optional(),
  maxWidth: z.number().int().optional(),
  maxHeight: z.number().int().optional(),
  maxLength: z.number().int().optional(),
})
export type LexVideo = z.infer<typeof lexVideo>

export const lexAudio = z.object({
  type: z.literal('audio'),
  description: z.string().optional(),
  accept: z.string().array().optional(),
  maxSize: z.number().optional(),
  maxLength: z.number().int().optional(),
})
export type LexAudio = z.infer<typeof lexAudio>

export const lexBlobVariant = z.union([lexBlob, lexImage, lexVideo, lexAudio])
export type LexBlobVariant = z.infer<typeof lexBlobVariant>

// complex types
// =

export const lexArray = z.object({
  type: z.literal('array'),
  description: z.string().optional(),
  items: z.union([
    lexPrimitive,
    lexBlobVariant,
    z.string(),
    z.string().array(),
  ]),
  minLength: z.number().int().optional(),
  maxLength: z.number().int().optional(),
})
export type LexArray = z.infer<typeof lexArray>

export const lexToken = z.object({
  type: z.literal('token'),
  description: z.string().optional(),
})
export type LexToken = z.infer<typeof lexToken>

export const lexObject = z.object({
  type: z.literal('object'),
  description: z.string().optional(),
  required: z.string().array().optional(),
  properties: z
    .record(
      z.union([
        z.string(),
        z.string().array(),
        lexArray,
        lexBlobVariant,
        lexPrimitive,
      ]),
    )
    .optional(),
})
export type LexObject = z.infer<typeof lexObject>

// xrpc
// =

export const lexXrpcParameters = z.object({
  type: z.literal('params'),
  description: z.string().optional(),
  required: z.string().array().optional(),
  properties: z.record(lexPrimitive),
})
export type LexXrpcParameters = z.infer<typeof lexXrpcParameters>

export const lexXrpcBody = z.object({
  description: z.string().optional(),
  encoding: z.union([z.string(), z.string().array()]),
  schema: z.union([z.string(), z.string().array(), lexObject]).optional(),
})
export type LexXrpcBody = z.infer<typeof lexXrpcBody>

export const lexXrpcError = z.object({
  name: z.string(),
  description: z.string().optional(),
})
export type LexXrpcError = z.infer<typeof lexXrpcError>

export const lexXrpcQuery = z.object({
  type: z.literal('query'),
  description: z.string().optional(),
  parameters: lexXrpcParameters.optional(),
  output: lexXrpcBody.optional(),
  errors: lexXrpcError.array().optional(),
})
export type LexXrpcQuery = z.infer<typeof lexXrpcQuery>

export const lexXrpcProcedure = z.object({
  type: z.literal('procedure'),
  description: z.string().optional(),
  parameters: lexXrpcParameters.optional(),
  input: lexXrpcBody.optional(),
  output: lexXrpcBody.optional(),
  errors: lexXrpcError.array().optional(),
})
export type LexXrpcProcedure = z.infer<typeof lexXrpcProcedure>

// database
// =

export const lexRecord = z.object({
  type: z.literal('record'),
  description: z.string().optional(),
  key: z.string().optional(),
  record: lexObject,
})
export type LexRecord = z.infer<typeof lexRecord>

// core
// =

export const lexUserType = z.union([
  lexRecord,

  lexXrpcQuery,
  lexXrpcProcedure,

  lexBlob,
  lexImage,
  lexVideo,
  lexAudio,

  lexArray,
  lexToken,
  lexObject,

  lexBoolean,
  lexNumber,
  lexInteger,
  lexString,
  lexDatetime,
  lexUnknown,
])
export type LexUserType = z.infer<typeof lexUserType>

export const lexiconDoc = z
  .object({
    lexicon: z.literal(1),
    id: z.string().refine((v: string) => NSID.isValid(v), {
      message: 'Must be a valid NSID',
    }),
    revision: z.number().optional(),
    description: z.string().optional(),
    defs: z.record(lexUserType),
  })
  .superRefine((doc: LexiconDoc, ctx) => {
    for (const defId in doc.defs) {
      const def = doc.defs[defId]
      if (
        defId !== 'main' &&
        (def.type === 'record' ||
          def.type === 'procedure' ||
          def.type === 'query')
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Records, procedures, and queries must be the main definition.`,
        })
      }
    }
  })
export type LexiconDoc = z.infer<typeof lexiconDoc>

// helpers
// =

export function isValidLexiconDoc(v: unknown): v is LexiconDoc {
  return lexiconDoc.safeParse(v).success
}

export function isObj(obj: unknown): obj is Record<string, unknown> {
  return !!obj && typeof obj === 'object'
}

export function hasProp<K extends PropertyKey>(
  data: object,
  prop: K,
): data is Record<K, unknown> {
  return prop in data
}

export class LexiconDocMalformedError extends Error {
  constructor(
    message: string,
    public schemaDef: unknown,
    public issues?: z.ZodIssue[],
  ) {
    super(message)
    this.schemaDef = schemaDef
    this.issues = issues
  }
}

export interface ValidationResult {
  success: boolean
  error?: ValidationError
}

export class ValidationError extends Error {}
export class InvalidLexiconError extends Error {}
export class LexiconDefNotFoundError extends Error {}