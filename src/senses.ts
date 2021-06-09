// @ts-ignore
export { fromInnerBarrel, iAmReExported } from "./barrel";
// @ts-ignore
// import * as notReExported from './nothing-exported';
export * from './barrel2';
export * from 'repeat-string';

export interface BfAdviseAuthTokenState {
  authToken: string;
  isLoading: boolean;
  hasError: boolean;
}

export const initialAuthTokenState: BfAdviseAuthTokenState = {
  authToken: 'foo',
  isLoading: false,
  hasError: false,
};

export enum AuthTokenActionTypes {
  GET_AUTH_TOKEN = '[auth] get auth token',
  GET_AUTH_TOKEN_SUCCESS = '[auth] get auth token success',
  GET_AUTH_TOKEN_FAIL = '[auth] get auth token fail',
}

export class GetAuthToken {
  readonly type = AuthTokenActionTypes.GET_AUTH_TOKEN;
}

export const getAuthtokenEpic = (httpClient: any) => (): any => {};

export function authTokenReducer(
  state: BfAdviseAuthTokenState = initialAuthTokenState,
) {
  return false;
}

const baz = 9;
const foo = 1;

export { baz, foo };

const myObj = {
  a: 1,
  b: 2,
};

export const { a, b: bAlias } = myObj;
