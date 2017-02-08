/**
 * JSON-RPC2実装モジュール。
 *
 * JSON-RPC2 の仕様については以下を参照。
 * http://www.jsonrpc.org/specification
 *
 * 本モジュールでは、基本的に入力は緩く受け付け、逆に出力は規格に厳密に行う。
 * @module ./index
 */

// フォーマットのバージョン
export const VERSION = "2.0";

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
export class JsonRpcError extends Error implements JsonRpc2ResponseError {
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
		this.name = "JsonRpcError";
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
			if (error["code"]) {
				json.code = error["code"];
			}
			if (error["message"]) {
				json.message = error["message"];
			}
			if (error["data"]) {
				json.data = error["data"];
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
			return "Parse error";
		case ErrorCode.InvalidRequest:
			return "Invalid Request";
		case ErrorCode.MethodNotFound:
			return "Method not found";
		case ErrorCode.InvalidParams:
			return "Invalid params";
		case ErrorCode.InternalError:
			return "Internal error";
	}
	if (code >= ServerErrorSince && code <= ServerErrorUntil) {
		return "Server error";
	}
	return "Unknown Error";
}

// JSON-RPC2リクエストID採番用カウンター
let idCounter = 0;

// callのPromise用マップ
const callbackMap: Map<number, { resolve: Function, reject: Function }> = new Map();

/**
 * JSON-RPC2リクエストを送信する。
 *
 * ※ 実際の送信処理はコールバックで渡す。
 * @param method メソッド名。
 * @param params 引数。
 * @param sender リクエストを実際に送信する処理。
 * @return レスポンスのJSONオブジェクト。
 */
export async function call(method: string, params: any, sender: (request: JsonRpc2Request) => any | Promise<any>): Promise<JsonRpc2Response> {
	// リクエストを送信するとともに、結果受け取り用のコールバックをマップに保存する
	// コールバックは、receiveがレスポンスを受信することで間接的に実行される
	return new Promise<JsonRpc2Response>((resolve, reject) => {
		const req = createRequest(method, params);
		callbackMap.set(<number>req.id, { resolve: resolve, reject: reject });
		// TODO: タイムアウトをチェックする
		try {
			const result = sender(req);
			if (result instanceof Promise) {
				result.catch((e) => {
					callbackMap.delete(<number>req.id);
					reject(e);
				});
			}
		} catch (e) {
			callbackMap.delete(<number>req.id);
			reject(e);
		}
	});
}

/**
 * JSON-RPC2通知リクエストを送信する。
 *
 * ※ 実際の送信処理はコールバックで渡す。
 * @param method メソッド名。
 * @param params 引数。
 * @param sender リクエストを実際に送信する処理。
 */
export async function notice(method: string, params: any, sender: (request: JsonRpc2Request) => any | Promise<any>): Promise<void> {
	const req = createNotification(method, params);
	const result = sender(req);
	if (result instanceof Promise) {
		await result;
	}
}

/**
 * JSON-RPC2リクエスト/レスポンスを受け取る。
 * @param message リクエスト/レスポンスのJSON文字列。
 * @param methodHandler メソッドを実行するためのハンドラー。
 * @return レスポンスのJSONオブジェクト。バッチリクエストの場合は配列。通知やレスポンスの場合はnull。
 */
export async function receive(message: string, methodHandler: (request: JsonRpc2Request) => any | Promise<any>): Promise<JsonRpc2Response | JsonRpc2Response[]> {
	// レスポンスの条件を満たす場合だけレスポンス、後は全てリクエストとして処理
	let json;
	try {
		json = parse(message);
	} catch (e) {
		return createResponse(null, null, e);
	}

	if (!Array.isArray(json)) {
		// 通常のリクエスト/レスポンス
		if (isResponse(json)) {
			doCallback(json);
		} else {
			return doMethod(json, methodHandler);
		}
	} else {
		// バッチリクエスト/レスポンス
		const responses = [];
		for (let j of json) {
			if (isResponse(j)) {
				doCallback(j);
			} else {
				const res = await doMethod(j, methodHandler);
				if (res) {
					responses.push(res);
				}
			}
		}
		if (responses.length > 0) {
			return responses;
		}
	}
}

/**
 * メソッドハンドラーを実行する。
 * @param request リクエスト情報。
 * @param methodHandler メソッドを実行するためのハンドラー。
 * @returns レスポンス情報。
 */
async function doMethod(request: JsonRpc2Request, methodHandler: (request: JsonRpc2Request) => any | Promise<any>): Promise<JsonRpc2Response> {
	// メソッドハンドラーをコールして、その結果をJSON-RPC2のレスポンスにする
	try {
		let result = methodHandler(request);
		if (result instanceof Promise) {
			result = await result;
		}
		// ID無しは応答不要なので、IDがある場合のみレスポンスを返す
		if (request.id !== undefined && request.id !== null) {
			return createResponse(request.id, result);
		}
	} catch (e) {
		// エラー時はリクエストIDの有無にかかわらず返す
		return createResponse(request.id, null, e);
	}
	return null;
}

/**
 * レスポンスのコールバックを実行する。
 * @param response レスポンス情報。
 */
function doCallback(response: JsonRpc2Response): void {
	// 該当IDのコールバックを実行する
	const cb = callbackMap.get(<any>response.id);
	if (!cb) {
		return;
	}
	callbackMap.delete(<any>response.id);
	if (response.error) {
		cb.reject(new JsonRpcError(response.error.code, response.error.message, response.error.data));
	} else {
		cb.resolve(response.result);
	}
}

/**
 * オブジェクトはレスポンスか？
 * @param json チェックするオブジェクト。
 * @returns レスポンスの場合true。
 */
function isResponse(json: any): boolean {
	return json.result !== undefined || json.error !== undefined;
}

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
 * JSON-RPC2レスポンスを生成する。
 * @param id リクエストのID。リクエストのパース失敗などではnull。
 * @param result リクエストの処理結果。
 * @param error リクエストがエラーの場合のエラー情報。
 * @returns 生成したレスポンス。
 */
export function createResponse(id: string | number, result: any, error?: any): JsonRpc2Response {
	if (id === undefined || id === null) {
		id = null;
	} else if (typeof (id) !== "number") {
		id = String(id);
	}
	const res: JsonRpc2Response = { jsonrpc: VERSION, id: id };
	if (error) {
		if (!(error instanceof JsonRpcError)) {
			error = JsonRpcError.convert(error);
		}
		res.error = error;
	} else {
		res.result = result || null;
	}
	return res;
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
 * JSON-RPC2リクエスト/レスポンスをパースする。
 * @param message パースするJSON文字列。
 * @returns パースしたリクエスト/レスポンス（バッチ実行の場合配列）。
 */
export function parse(message: string): JsonRpc2Request | JsonRpc2Request[] | JsonRpc2Response | JsonRpc2Response[] {
	// レスポンスの条件を満たす場合だけレスポンス、後は全てリクエストとして処理
	// ※ 現状はJSONのパースと一括でエラーにできるチェックだけ
	//    （ここで中身までみると、バッチが全部エラーになってしまうので）
	let json: any;
	try {
		json = JSON.parse(message);
	} catch (e) {
		throw new JsonRpcError(ErrorCode.ParseError);
	}
	if (!(json instanceof Object)) {
		throw new JsonRpcError(ErrorCode.InvalidRequest);
	}
	if (Array.isArray(json) && json.length === 0) {
		throw new JsonRpcError(ErrorCode.InvalidRequest);
	}
	return json;
}

/**
 * JSON-RPC2リクエストをパースする。
 * @param message パースするJSON文字列。
 * @returns パースしたリクエスト（バッチ実行の場合配列）。
 * @deprecated since ver 0.2
 */
export function parseRequest(message: string): JsonRpc2Request | JsonRpc2Request[] {
	// ※ parseに統合されかつ処理内容が同じなので統合
	return <any>parse(message);
}

/**
 * JSON-RPC2のレスポンスをパースする。
 * @param message パースするJSON文字列。
 * @returns パースしたレスポンス（バッチ実行の場合配列）。
 * @deprecated since ver 0.2
 */
export function parseResponse(message: string): JsonRpc2Response | JsonRpc2Response[] {
	// 基本的にバージョンチェックなどは行っていないため、現状ほぼJSON.parseのラッパー
	let res: any;
	try {
		res = JSON.parse(message);
	} catch (e) {
		throw new JsonRpcError(ErrorCode.ParseError);
	}
	if (res === null || typeof res !== "object") {
		throw new JsonRpcError(ErrorCode.ParseError);
	}
	return res;
}