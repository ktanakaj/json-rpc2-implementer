/**
 * JSON-RPC2実装モジュール。
 *
 * JSON-RPC2 の仕様については以下を参照。
 * http://www.jsonrpc.org/specification
 *
 * 本モジュールでは、基本的に入力は緩く受け付け、逆に出力は規格に厳密に行う。
 * @module ./lib/
 */
import { JsonRpc2Request, JsonRpc2Response, JsonRpc2ResponseError, VERSION } from './const';
import { JsonRpcError, ErrorCode } from './error';
import { receive, parseRequest, createResponse } from './callee';
import { createRequest, createNotification, parseResponse } from './caller';

export {
	JsonRpc2Request,
	JsonRpc2Response,
	JsonRpc2ResponseError,
	VERSION,
	JsonRpcError,
	ErrorCode,
	receive,
	parseRequest,
	createResponse,
	createRequest,
	createNotification,
	parseResponse,
}