export declare const VERSION = "2.0";
export interface JsonRpc2Request {
    jsonrpc: string;
    method: string;
    params?: any;
    id?: number | string;
}
export interface JsonRpc2Response {
    jsonrpc: string;
    result?: any;
    error?: JsonRpc2ResponseError;
    id: number | string;
}
export interface JsonRpc2ResponseError {
    code: number;
    message: string;
    data?: any;
}
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
export declare function call(method: string, params: any, sender: (request: JsonRpc2Request) => any | Promise<any>): Promise<JsonRpc2Response>;
export declare function notice(method: string, params: any, sender: (request: JsonRpc2Request) => any | Promise<any>): Promise<void>;
export declare function receive(message: string, methodHandler: (request: JsonRpc2Request) => any | Promise<any>): Promise<JsonRpc2Response | JsonRpc2Response[]>;
export declare function createRequest(method: string, params?: any, id?: string | number): JsonRpc2Request;
export declare function createResponse(id: string | number, result: any, error?: any): JsonRpc2Response;
export declare function createNotification(method: string, params?: any): JsonRpc2Request;
export declare function parse(message: string): JsonRpc2Request | JsonRpc2Request[] | JsonRpc2Response | JsonRpc2Response[];
export declare function parseRequest(message: string): JsonRpc2Request | JsonRpc2Request[];
export declare function parseResponse(message: string): JsonRpc2Response | JsonRpc2Response[];
