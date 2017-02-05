/**
 * JSON-RPC2受信側実装モジュール。
 * @module ./lib/callee
 */
import { JsonRpc2Request, JsonRpc2Response, JsonRpc2ResponseError, VERSION } from './const';
import { JsonRpcError, ErrorCode } from './error';

/**
 * JSON-RPC2リクエストを受け取る。
 * @param message リクエストのJSON文字列。
 * @param methodHandler メソッドを実行するためのハンドラー。
 * @return レスポンスのJSONオブジェクト。バッチリクエストの場合は配列。通知の場合はnull。
 */
export async function receive(message: string, methodHandler: (request: JsonRpc2Request) => any | Promise<any>): Promise<JsonRpc2Response | JsonRpc2Response[]> {
	let req;
	try {
		req = parseRequest(message);
	} catch (e) {
		return createResponse(null, null, e);
	}
	if (!Array.isArray(req)) {
		// 通常のリクエスト
		return doMethod(req, methodHandler);
	} else {
		// バッチリクエスト
		const responses = [];
		for (let r of req) {
			const res = await doMethod(r, methodHandler);
			if (res) {
				responses.push(res);
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
 * JSON-RPC2リクエストをパースする。
 * @param message パースするJSON文字列。
 * @returns パースしたリクエスト（バッチ実行の場合配列）。
 */
export function parseRequest(message: string): JsonRpc2Request | JsonRpc2Request[] {
	// ※ 現状はJSONのパースと一括でエラーにできるチェックだけ
	//    （ここで中身までみると、バッチが全部エラーになってしまうので）
	let req: any;
	try {
		req = JSON.parse(message);
	} catch (e) {
		throw new JsonRpcError(ErrorCode.ParseError);
	}
	if (!(req instanceof Object)) {
		throw new JsonRpcError(ErrorCode.InvalidRequest);
	}
	if (Array.isArray(req) && req.length === 0) {
		throw new JsonRpcError(ErrorCode.InvalidRequest);
	}
	return req;
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
	} else if (result) {
		res.result = result;
	}
	return res;
}
