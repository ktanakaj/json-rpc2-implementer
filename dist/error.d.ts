import { JsonRpc2ResponseError } from './const';
export declare enum ErrorCode {
    ParseError = -32700,
    InvalidRequest = -32600,
    MethodNotFound = -32601,
    InvalidParams = -32602,
    InternalError = -32603,
}
export declare class JsonRpcError extends Error {
    code: number;
    data: any;
    constructor(code?: number, message?: string, data?: any);
    toJSON(): JsonRpc2ResponseError;
    static convert(error: any): JsonRpcError;
}
