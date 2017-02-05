/**
 * JSON-RPC2インターフェース/定数モジュール。
 * @module ./lib/const
 */

// フォーマットのバージョン
export const VERSION = '2.0';

// リクエストJSON
export interface JsonRpc2Request {
	jsonrpc: string;
	method: string;
	params?: any;
	id?: number | string;
}

// レスポンスJSON
export interface JsonRpc2Response {
	jsonrpc: string;
	result?: any;
	error?: JsonRpc2ResponseError;
	id: number | string;
}

// レスポンスJSONのエラー情報
export interface JsonRpc2ResponseError {
	code: number;
	message: string;
	data?: any;
}
