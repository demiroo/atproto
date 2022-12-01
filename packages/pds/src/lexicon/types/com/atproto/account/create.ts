/**
* GENERATED CODE - DO NOT MODIFY
*/
import express from 'express'

export interface QueryParams {}

export interface InputSchema {
  email: string;
  handle: string;
  inviteCode?: string;
  password: string;
  recoveryKey?: string;
  [k: string]: unknown;
}

export interface OutputSchema {
  accessJwt: string;
  refreshJwt: string;
  handle: string;
  did: string;
  [k: string]: unknown;
}

export interface HandlerInput {
  encoding: 'application/json';
  body: InputSchema;
}

export interface HandlerSuccess {
  encoding: 'application/json';
  body: OutputSchema;
}

export interface HandlerError {
  status: number;
  message?: string;
  error?:
    | 'InvalidHandle'
    | 'InvalidPassword'
    | 'InvalidInviteCode'
    | 'HandleNotAvailable';
}

export type HandlerOutput = HandlerError | HandlerSuccess
export type Handler = (
  params: QueryParams,
  input: HandlerInput,
  req: express.Request,
  res: express.Response
) => Promise<HandlerOutput> | HandlerOutput