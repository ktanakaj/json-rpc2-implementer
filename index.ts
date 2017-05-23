/**
 * JSON-RPC2実装モジュール。
 *
 * JSON-RPC2 の仕様については以下を参照。
 * http://www.jsonrpc.org/specification
 *
 * 本モジュールでは、基本的に入力は緩く受け付け、逆に出力は規格に厳密に行う。
 * @module ./index
 */

/** フォーマットのバージョン */
export const VERSION = "2.0";

/** リクエストJSON */
export interface JsonRpc2Request {
	jsonrpc: string;
	method: string;
	params?: any;
	id?: number | string;
}

/** レスポンスJSON */
export interface JsonRpc2Response {
	jsonrpc: string;
	result?: any;
	error?: JsonRpc2ResponseError;
	id: number | string;
}

/** レスポンスJSONのエラー情報 */
export interface JsonRpc2ResponseError {
	code: number;
	message: string;
	data?: any;
}

/**
 * JSON-RPC2規定のエラーコード。
 * ※ -32768 から -32000 は予約されているようなので通常のアプリで使わないよう注意
 */
export enum ErrorCode {
	ParseError = -32700,
	InvalidRequest = -32600,
	MethodNotFound = -32601,
	InvalidParams = -32602,
	InternalError = -32603,
};

/** サーバーエラーのコード範囲開始 */
const ServerErrorSince = -32000;
/** サーバーエラーのコード範囲終了 */
const ServerErrorUntil = -32099;
/** 32bit整数の最大値 */
const MAX_INT32 = 2147483647;

/**
 * JSON-RPC2のエラー情報と互換性を持たせた例外クラス。
 */
export class JsonRpcError extends Error implements JsonRpc2ResponseError {
	/** エラーコード */
	code: number;
	/** 例外追加情報 */
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

/**
 * レスポンス不要を通知するためのシンボル。
 */
export const NoResponse = Symbol('NoResponse');

/**
 * JSON-RPC2実装クラス。
 */
export class JsonRpc2Implementer {
	/** RPC送信処理 */
	sender: (message: string) => any | Promise<any>;
	/** メソッド呼び出し処理 */
	methodHandler: (method: string, params: any, id: number | string) => any | Promise<any>;
	/** callのタイムアウト時間（ミリ秒） */
	timeout: number = 60000;

	/** JSON-RPC2リクエストID採番用カウンター */
	protected idCounter: number = 0;
	/** callのPromise用マップ */
	protected callbackMap: Map<number | string, { resolve: Function, reject: Function }> = new Map();

	/**
	 * JSON-RPC2リクエストを送信する。
	 *
	 * ※ 事前に this.sender の登録が必要（未登録の場合エラー）。
	 * @param method メソッド名。
	 * @param params 引数。
	 * @param id ID。未指定時は連番で自動生成。
	 * @return メソッドの処理結果。
	 */
	async call(method: string, params?: any, id?: number | string): Promise<any> {
		// リクエストを送信するとともに、結果受け取り用のコールバックをマップに保存する
		// コールバックは、receiveがレスポンスを受信することで間接的に実行される
		const self = this;
		return new Promise<any>((resolve, reject) => {
			const req = this.createRequest(method, params, id);
			this.callbackMap.set(req.id, { resolve: resolve, reject: reject });
			try {
				const result = this.sender(JSON.stringify(req));
				if (isPromise(result)) {
					result.catch(removeIdAndReject);
				}
				// タイムアウト処理
				if (this.timeout > 0) {
					setTimeout(() => {
						if (this.callbackMap.has(req.id)) {
							const e = new Error(`RPC response timeouted. (${JSON.stringify(req)})`);
							e.name = "TimeoutError";
							removeIdAndReject(e);
						}
					}, this.timeout);
				}
			} catch (e) {
				removeIdAndReject(e);
			}

			/**
			 * コールバック用マップからIDを消去しPromiseをエラーで終わる。
			 * @param e エラー情報。
			 */
			function removeIdAndReject(e: any): void {
				self.callbackMap.delete(req.id);
				reject(e);
			}
		});
	}

	/**
	 * JSON-RPC2通知リクエストを送信する。
	 *
	 * ※ 事前に this.sender の登録が必要（未登録の場合エラー）。
	 * @param method メソッド名。
	 * @param params 引数。
	 * @return 処理状態。
	 */
	async notice(method: string, params?: any): Promise<void> {
		const req = this.createNotification(method, params);
		const result = this.sender(JSON.stringify(req));
		if (isPromise(result)) {
			await result;
		}
	}

	/**
	 * JSON-RPC2リクエスト/レスポンスを受け取る。
	 *
	 * ※ 事前に this.sender の登録が必要（未登録の場合エラー）。
	 * @param message リクエスト/レスポンスのJSON文字列。
	 * @return 処理状態。
	 */
	async receive(message: string): Promise<void> {
		let res;
		try {
			res = await this.doMetodOrCallback(this.parse(message));
		} catch (e) {
			res = this.createResponse(null, null, e);
		}
		if (res) {
			const result = this.sender(JSON.stringify(res));
			if (isPromise(result)) {
				await result;
			}
		}
	}

	/**
	 * JSON-RPC2リクエスト/レスポンスを処理する。
	 * @param json リクエスト/レスポンスのJSON。
	 * @return レスポンスのJSONオブジェクト。バッチリクエストの場合は配列。通知やレスポンスの場合はnull。
	 */
	async doMetodOrCallback(json: JsonRpc2Request | JsonRpc2Request[] | JsonRpc2Response | JsonRpc2Response[]): Promise<JsonRpc2Response | JsonRpc2Response[]> {
		// レスポンスの条件を満たす場合だけレスポンス、後は全てリクエストとして処理
		if (!Array.isArray(json)) {
			// 通常のリクエスト/レスポンス
			if (this.isResponse(json)) {
				this.doCallback(<JsonRpc2Response>json);
			} else {
				return this.doMethod(<JsonRpc2Request>json);
			}
		} else {
			// バッチリクエスト/レスポンス
			const responses = [];
			for (let j of json) {
				if (this.isResponse(j)) {
					this.doCallback(<JsonRpc2Response>j);
				} else {
					const res = await this.doMethod(<JsonRpc2Request>j);
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
	 * @returns レスポンス情報。
	 */
	protected async doMethod(request: JsonRpc2Request): Promise<JsonRpc2Response> {
		// メソッドハンドラーをコールして、その結果をJSON-RPC2のレスポンスにする
		try {
			if (!this.methodHandler) {
				throw new JsonRpcError(ErrorCode.MethodNotFound);
			}
			let result = this.methodHandler(request.method, request.params, request.id);
			if (isPromise(result)) {
				result = await result;
			}
			// ID無しは応答不要なので、IDがある場合のみレスポンスを返す
			if (result !== NoResponse && request.id !== undefined && request.id !== null) {
				return this.createResponse(request.id, result);
			}
		} catch (e) {
			// エラー時はリクエストIDの有無にかかわらず返す
			return this.createResponse(request.id, null, e);
		}
		return null;
	}

	/**
	 * レスポンスのコールバックを実行する。
	 * @param response レスポンス情報。
	 */
	protected doCallback(response: JsonRpc2Response): void {
		// 該当IDのコールバックを実行する
		const cb = this.callbackMap.get(response.id);
		if (!cb) {
			return;
		}
		this.callbackMap.delete(response.id);
		if (response.error) {
			cb.reject(new JsonRpcError(response.error.code, response.error.message, response.error.data));
		} else {
			cb.resolve(response.result);
		}
	}

	/**
	 * JSON-RPC2のリクエストを生成する。
	 * @param method メソッド名。
	 * @param params 引数。
	 * @param id ID。未指定時は連番で自動生成。
	 * @returns リクエストJSONオブジェクト。
	 */
	createRequest(method: string, params?: any, id?: string | number): JsonRpc2Request {
		if (id === null || id === undefined) {
			id = this.generateId();
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
	createResponse(id: string | number, result: any, error?: any): JsonRpc2Response {
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
	createNotification(method: string, params?: any): JsonRpc2Request {
		return { jsonrpc: VERSION, method: method, params: params };
	}

	/**
	 * JSON-RPC2リクエスト/レスポンスをパースする。
	 * @param message パースするJSON文字列。
	 * @returns パースしたリクエスト/レスポンス（バッチ実行の場合配列）。
	 */
	parse(message: string): JsonRpc2Request | JsonRpc2Request[] | JsonRpc2Response | JsonRpc2Response[] {
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
	 * オブジェクトはレスポンスか？
	 * @param json チェックするオブジェクト。
	 * @returns レスポンスの場合true。
	 */
	isResponse(json: any): boolean {
		return json.result !== undefined || json.error !== undefined;
	}

	/**
	 * リクエスト用のIDを発行する。
	 * @returns 生成したID。
	 */
	private generateId(): number {
		// 安全のために、int32の正の範囲内だけ使用
		if (this.idCounter >= MAX_INT32) {
			this.idCounter = 0;
		}
		return ++this.idCounter;
	}
}

/**
 * オブジェクトはPromiseか？
 * @param obj チェックするオブジェクト。
 * @returns Promiseの場合true。
 */
function isPromise(obj: any): boolean {
	// bluebirdなどが有効な環境だと、instanceofだけでは正しく判定できないためその対処
	// http://stackoverflow.com/questions/27746304/how-do-i-tell-if-an-object-is-a-promise
	return obj instanceof Promise || (obj && typeof obj.then === 'function');
}

// ※※ 以下はVer0.21以前との互換用のメソッド。後日削除 ※※
/**
 * 互換メソッド用インスタンス。
 * @deprecated since ver 0.3
 */
const impl = new JsonRpc2Implementer();

/**
 * JSON-RPC2リクエストを送信する。
 *
 * ※ 実際の送信処理はコールバックで渡す。
 * @param method メソッド名。
 * @param params 引数。
 * @param id ID。未指定時は連番で自動生成。
 * @return メソッドの処理結果。
 * @deprecated since ver 0.3
 */
export async function call(method: string, params: any, sender: (request: JsonRpc2Request) => any | Promise<any>): Promise<any> {
	impl.sender = (message) => sender(JSON.parse(message));
	return impl.call(method, params);
}

/**
 * JSON-RPC2通知リクエストを送信する。
 *
 * ※ 実際の送信処理はコールバックで渡す。
 * @param method メソッド名。
 * @param params 引数。
 * @return 処理状態。
 * @deprecated since ver 0.3
 */
export async function notice(method: string, params: any, sender: (request: JsonRpc2Request) => any | Promise<any>): Promise<void> {
	impl.sender = (message) => sender(JSON.parse(message));
	return await impl.notice(method, params);
}

/**
 * JSON-RPC2リクエスト/レスポンスを受け取る。
 * @param message リクエスト/レスポンスのJSON文字列。
 * @return 処理状態。
 * @deprecated since ver 0.3
 */
export async function receive(message: string, methodHandler: (request: JsonRpc2Request) => any | Promise<any>): Promise<JsonRpc2Response | JsonRpc2Response[]> {
	impl.methodHandler = (method, params, id) => {
		let req: JsonRpc2Request = { jsonrpc: VERSION, method: method, params: params };
		if (id !== undefined) {
			req.id = id;
		}
		return methodHandler(req);
	};
	try {
		return await impl.doMetodOrCallback(impl.parse(message));
	} catch (e) {
		return impl.createResponse(null, null, e);
	}
}

/**
 * JSON-RPC2のリクエストを生成する。
 * @param method メソッド名。
 * @param params 引数。
 * @param id ID。未指定時は連番で自動生成。
 * @returns リクエストJSONオブジェクト。
 * @deprecated since ver 0.3
 */
export function createRequest(method: string, params?: any, id?: string | number): JsonRpc2Request {
	return impl.createRequest(method, params, id);
}

/**
 * JSON-RPC2レスポンスを生成する。
 * @param id リクエストのID。リクエストのパース失敗などではnull。
 * @param result リクエストの処理結果。
 * @param error リクエストがエラーの場合のエラー情報。
 * @returns 生成したレスポンス。
 * @deprecated since ver 0.3
 */
export function createResponse(id: string | number, result: any, error?: any): JsonRpc2Response {
	return impl.createResponse(id, result, error);
}

/**
 * JSON-RPC2の通知リクエストを生成する。
 * @param method メソッド名。
 * @param params 引数。
 * @returns リクエストJSONオブジェクト。
 * @deprecated since ver 0.3
 */
export function createNotification(method: string, params?: any): JsonRpc2Request {
	return impl.createNotification(method, params);
}

/**
 * JSON-RPC2リクエスト/レスポンスをパースする。
 * @param message パースするJSON文字列。
 * @returns パースしたリクエスト/レスポンス（バッチ実行の場合配列）。
 * @deprecated since ver 0.3
 */
export function parse(message: string): JsonRpc2Request | JsonRpc2Request[] | JsonRpc2Response | JsonRpc2Response[] {
	return impl.parse(message);
}