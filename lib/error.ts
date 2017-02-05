/**
 * JSON-RPC2エラー処理モジュール。
 * @module ./lib/error
 */
import { JsonRpc2ResponseError } from './const';

// JSON-RPC2規定のエラーコード
// ※ -32768 から -32000 は予約されているようなので通常のアプリで使わないよう注意
export enum ErrorCode {
	ParseError = -32700,
	InvalidRequest = -32600,
	MethodNotFound = -32601,
	InvalidParams = -32602,
	InternalError = -32603,
};

// サーバーエラーのコード範囲開始
const ServerErrorSince = -32000;
// サーバーエラーのコード範囲終了
const ServerErrorUntil = -32099;

/**
 * JSON-RPC2のエラー情報と互換性を持たせた例外クラス。
 */
export class JsonRpcError extends Error {
	// エラーコード
	code: number;
	// 例外追加情報
	data: any;

	/**
	 * 例外を生成する。
	 * @param code エラーコード。
	 * @param message 例外エラーメッセージ。
	 * @param data 例外追加情報。
	 */
	constructor(code: number = ErrorCode.InternalError, message?: string, data?: any) {
		super(message || makeDefaultErrorMessage(code));
		this.name = 'JsonRpcError';
		this.code = code;
		this.data = data;
	}

	/**
	 * JSON-RPC2エラー情報形式のJSONを生成する。
	 * @returns JSON-RPC2エラー情報。
	 */
	toJSON(): JsonRpc2ResponseError {
		const json: JsonRpc2ResponseError = {
			code: Number(this.code),
			message: String(this.message),
		};
		if (this.data !== undefined) {
			json.data = this.data;
		}
		return json;
	}

	/**
	 * 形式不明のエラー情報をJSON-RPC2用エラーに変換する。
	 * @param error エラー情報。
	 * @returns 生成したエラー。
	 */
	static convert(error: any): JsonRpcError {
		if (error instanceof JsonRpcError) {
			return error;
		}
		const json = new JsonRpcError();
		if (error instanceof Error) {
			if (error['code']) {
				json.code = error['code'];
			}
			if (error['message']) {
				json.message = error['message'];
			}
			if (error['data']) {
				json.data = error['data'];
			}
		} else {
			json.message = String(error);
		}
		return json;
	}
}

/**
 * エラーコードからデフォルトエラーメッセージを生成する。
 * @param code エラーコード。
 * @return エラーメッセージ。
 */
function makeDefaultErrorMessage(code: number): string {
	switch (code) {
		case ErrorCode.ParseError:
			return 'Parse error';
		case ErrorCode.InvalidRequest:
			return 'Invalid Request';
		case ErrorCode.MethodNotFound:
			return 'Method not found';
		case ErrorCode.InvalidParams:
			return 'Invalid params';
		case ErrorCode.InternalError:
			return 'Internal error';
	}
	if (code >= -32000 && code <= -32099) {
		return 'Server error';
	}
	return 'Unknown Error';
}