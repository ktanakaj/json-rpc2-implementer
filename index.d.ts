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
    InternalError = -32603
}
export declare class JsonRpcError extends Error implements JsonRpc2ResponseError {
    code: number;
    data: any;
    constructor(code?: number, message?: string, data?: any);
    toJSON(): JsonRpc2ResponseError;
    static convert(error: any): JsonRpcError;
}
export declare const NoResponse: unique symbol;
export declare class JsonRpc2Implementer {
    sender: (message: string) => any | Promise<any>;
    methodHandler: (method: string, params: any, id: number | string) => any | Promise<any>;
    timeout: number;
    protected idCounter: number;
    protected callbackMap: Map<number | string, {
        resolve: Function;
        reject: Function;
    }>;
    call(method: string, params?: any, id?: number | string): Promise<any>;
    notice(method: string, params?: any): Promise<void>;
    receive(message: string): Promise<void>;
    doMetodOrCallback(json: JsonRpc2Request | JsonRpc2Request[] | JsonRpc2Response | JsonRpc2Response[]): Promise<JsonRpc2Response | JsonRpc2Response[]>;
    protected doMethod(request: JsonRpc2Request): Promise<JsonRpc2Response>;
    protected doCallback(response: JsonRpc2Response): void;
    createRequest(method: string, params?: any, id?: string | number): JsonRpc2Request;
    createResponse(id: string | number, result: any, error?: any): JsonRpc2Response;
    createNotification(method: string, params?: any): JsonRpc2Request;
    parse(message: string): JsonRpc2Request | JsonRpc2Request[] | JsonRpc2Response | JsonRpc2Response[];
    isResponse(json: any): boolean;
    private generateId;
}
