/**
 * JSON-RPC2送信側実装モジュール。
 * @module ./lib/caller
 */
import { JsonRpc2Request, JsonRpc2Response, JsonRpc2ResponseError, VERSION } from './const';
import { JsonRpcError, ErrorCode } from './error';

// JSON-RPC2用ID採番元
let idCounter = 0;

/**
 * JSON-RPC2のリクエストを生成する。
 * @param method メソッド名。
 * @param params 引数。
 * @param id ID。未指定時は連番で自動生成。
 * @returns リクエストJSONオブジェクト。
 */
export function createRequest(method: string, params?: any, id?: string | number): JsonRpc2Request {
	if (id === null || id === undefined) {
		id = ++idCounter;
	} else if (typeof (id) !== "number") {
		id = String(id);
	}
	return { jsonrpc: VERSION, method: method, params: params, id: id };
}

/**
 * JSON-RPC2の通知リクエストを生成する。
 * @param method メソッド名。
 * @param params 引数。
 * @returns リクエストJSONオブジェクト。
 */
export function createNotification(method: string, params?: any): JsonRpc2Request {
	return { jsonrpc: VERSION, method: method, params: params };
}

/**
 * JSON-RPC2のレスポンスをパースする。
 * @param message パースするJSON文字列。
 * @returns パースしたレスポンス（バッチ実行の場合配列）。
 */
export function parseResponse(message: string): JsonRpc2Response | JsonRpc2Response[] {
	// 基本的にバージョンチェックなどは行っていないため、現状ほぼJSON.parseのラッパー
	let res: any;
	try {
		res = JSON.parse(message);
	} catch (e) {
		throw new JsonRpcError(ErrorCode.ParseError);
	}
	if (res === null || typeof res !== 'object') {
		throw new JsonRpcError(ErrorCode.ParseError);
	}
	return res;
}