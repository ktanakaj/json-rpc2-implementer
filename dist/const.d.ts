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
