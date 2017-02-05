import { JsonRpc2Request, JsonRpc2Response } from './const';
export declare function receive(message: string, methodHandler: (request: JsonRpc2Request) => any | Promise<any>): Promise<JsonRpc2Response | JsonRpc2Response[]>;
export declare function parseRequest(message: string): JsonRpc2Request | JsonRpc2Request[];
export declare function createResponse(id: string | number, result: any, error?: any): JsonRpc2Response;
