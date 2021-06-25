export * from './jsx'
// @ts-ignore
export { fromInnerBarrel } from "@barrel-alias";
export { iAmReExported } from './barrel/partial-export';
// @ts-ignore
export * from './nothing-exported';
export * from './barrel2';

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
const foobar = 1;

export { baz, foobar };

const myObj = {
  a: 1,
  b: 2,
};

export const { a, b: bAlias } = myObj;
