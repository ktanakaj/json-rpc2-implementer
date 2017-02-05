import { JsonRpc2Request, JsonRpc2Response } from './const';
export declare function createRequest(method: string, params?: any, id?: string | number): JsonRpc2Request;
export declare function createNotification(method: string, params?: any): JsonRpc2Request;
export declare function parseResponse(message: string): JsonRpc2Response | JsonRpc2Response[];
