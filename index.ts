/**
 * JSON-RPC2 mounting module.
 *
 * See below for JSON-RPC2 specifications。
 * https://www.jsonrpc.org/specification
 *
 * In this module basically, the input is loosely accepted, and conversely,
 * the output is strictly performed on the standard.
 * @module ./index
 */

/** Format version */
export const VERSION = "2.0";

/** Request JSON */
export interface JsonRpc2Request {
	jsonrpc: string;
	method: string;
	params?: any;
	id?: number | string;
}

/** Response JSON */
export interface JsonRpc2Response {
	jsonrpc: string;
	result?: any;
	error?: JsonRpc2ResponseError;
	id: number | string;
}

/** Response JSON error information */
export interface JsonRpc2ResponseError {
	code: number;
	message: string;
	data?: any;
}

/**
 * Error code for JSON-RPC2 specified.
 * ※ Since -32768 to -32000 is reserved, careful not to use with regular apps
 */
export enum ErrorCode {
	ParseError = -32700,
	InvalidRequest = -32600,
	MethodNotFound = -32601,
	InvalidParams = -32602,
	InternalError = -32603,
}

/** Starting code range of server error */
const ServerErrorSince = -32000;
/** Code range of server error end */
const ServerErrorUntil = -32099;
/** Maximum value of 32-bit integer */
const MAX_INT32 = 2147483647;

/**
 * Exception classes compatible with JSON-RPC2 error information.
 */
export class JsonRpcError extends Error implements JsonRpc2ResponseError {
	/** Error code */
	code: number;
	/** Exception Additional Information */
	data: any;

	/**
	 * Generate an exception.
	 * @param code Error code.
	 * @param message Exception error message.
	 * @param data Exception Additional Information.
	 */
	constructor(code: number = ErrorCode.InternalError, message?: string, data?: any) {
		super(message || makeDefaultErrorMessage(code));
		this.name = "JsonRpcError";
		this.code = code;
		this.data = data;
	}

	/**
	 * JSON-Generate JSON in RPC2 error information format.
	 * @returns JSON-RPC2 error information.
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
	 * Convert unformatted error information to JSON-RPC2 error.
	 * @param error Error information.
	 * @returns Generated error.
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
 * Generate a default error message from the error code.
 * @param code Error code.
 * @return Error message.
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
 * Symbol for notifying notification of response.
 */
export const NoResponse = Symbol('NoResponse');

/**
 * JSON-RPC2 implementation class.
 */
export class JsonRpc2Implementer {
	/** RPC transmission process */
	sender: (message: string) => any | Promise<any>;
	/** Method call processing */
	methodHandler: (method: string, params: any, id: number | string) => any | Promise<any>;
	/** CALL Timeout Time (Millisecond) */
	timeout: number = 60000;

	/** JSON-RPC2 Request ID Counter for Counter */
	protected idCounter: number = 0;
	/** CALL map for Promise */
	protected callbackMap: Map<number | string, { resolve: Function, reject: Function }> = new Map();

	/**
	 * Send a JSON-RPC2 request.
	 *
	 * ※ Registration of this.Sender needs in advance (error if not registered).
	 * @param method Method name.
	 * @param params argument.
	 * @param id ID.Automatic generation occurs in a sequence number when not specified.
	 * @return Method processing results.
	 */
	async call(method: string, params?: any, id?: number | string): Promise<any> {
		// Send a request and save the callback for receiving the call back to the map
		// Callback is executed indirectly by receiving response
		const self = this;
		return new Promise<any>((resolve, reject) => {
			const req = this.createRequest(method, params, id);
			this.callbackMap.set(req.id, { resolve: resolve, reject: reject });
			try {
				const result = this.sender(JSON.stringify(req));
				if (isPromise(result)) {
					result.catch(removeIdAndReject);
				}
				// Timeout processing
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
			 * The ID is erased from the callback map and Promise ends with an error.
			 * @param E error information.
			 */
			function removeIdAndReject(e: any): void {
				self.callbackMap.delete(req.id);
				reject(e);
			}
		});
	}

	/**
	 * Send JSON-RPC2 notification request.
	 *
	 * ※ Registration of this.Sender needs in advance (error if not registered).
	 * @param method Method name.
	 * @param params argument.
	 * @return Processing state.
	 */
	async notice(method: string, params?: any): Promise<void> {
		const req = this.createNotification(method, params);
		const result = this.sender(JSON.stringify(req));
		if (isPromise(result)) {
			await result;
		}
	}

	/**
	 * JSON-RPC2 Request / Response is received.
	 *
	 * ※ Registration of this.Sender needs in advance (error if not registered).
	 * @param message Request / Response JSON String.
	 * @return Processing state.
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
	 * Process JSON-RPC2 request / response.
	 * @param json Request / Response JSON.
	 * @return Response JSON Object.Array for batch requests.Null for notifications and responses.
	 */
	async doMetodOrCallback(json: JsonRpc2Request | JsonRpc2Request[] | JsonRpc2Response | JsonRpc2Response[]): Promise<JsonRpc2Response | JsonRpc2Response[]> {
		// Response only if you meet the condition of the response, all processed as a request
		if (!Array.isArray(json)) {
			// Normal request / response
			if (this.isResponse(json)) {
				this.doCallback(<JsonRpc2Response>json);
			} else {
				return this.doMethod(<JsonRpc2Request>json);
			}
		} else {
			// Batch request / response
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
	 * Method Run the handler.
	 * @param request Request information.
	 * @returns Response information.
	 */
	protected async doMethod(request: JsonRpc2Request): Promise<JsonRpc2Response> {
		// Call method handler to make the results as JSON-RPC2 responses
		try {
			if (!this.methodHandler) {
				throw new JsonRpcError(ErrorCode.MethodNotFound);
			}
			let result = this.methodHandler(request.method, request.params, request.id);
			if (isPromise(result)) {
				result = await result;
			}
			// There is no ID without an ID, so returns a response only if there is an ID
			if (result !== NoResponse && request.id !== undefined && request.id !== null) {
				return this.createResponse(request.id, result);
			}
		} catch (e) {
			// In response to an error, it will be returned regardless of the request ID
			return this.createResponse(request.id, null, e);
		}
		return null;
	}

	/**
	 * Run a response callback.
	 * @param response Response information.
	 */
	protected doCallback(response: JsonRpc2Response): void {
		// Run the callback of the corresponding ID
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
	 * Generate a request for JSON-RPC2.
	 * @param method Method name.
	 * @param params argument.
	 * @param id ID.Automatic generation occurs in a sequence number when not specified.
	 * @returns Request JSON Object.
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
	 * Generate a JSON-RPC2 response.
	 * @param id Request ID.NULL on request parsing failure.
	 * @param result Processing results of requests.
	 * @param error Error information when request is an error.
	 * @returns Generated responses.
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
	 * Generate a JSON-RPC2 notification request.
	 * @param method Method name.
	 * @param params argument.
	 * @returns Request JSON Object.
	 */
	createNotification(method: string, params?: any): JsonRpc2Request {
		return { jsonrpc: VERSION, method: method, params: params };
	}

	/**
	 * Parse the JSON-RPC2 request / response.
	 * @param message JSON string to parse.
	 * @returnsPer-spared request / response (array for batch execution).
	 */
	parse(message: string): JsonRpc2Request | JsonRpc2Request[] | JsonRpc2Response | JsonRpc2Response[] {
	// If you meet the condition of the response, it will only respond, after all after the response.
	// * Only the current situation can be an error in the parses of JSON and collectively
	// (If you look at the contents here, all batches will have an error)
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
	 * Is the object responding?
	 * @param json Object to check.
	 * @returns TRUE for response.
	 */
	isResponse(json: any): boolean {
		return json.result !== undefined || json.error !== undefined;
	}

	/**
	 * Issue an ID for request.
	 * @returnsGenerated ID.
	 */
	private generateId(): number {
		// Use only within the positive range of INT32 for safety
		if (this.idCounter >= MAX_INT32) {
			this.idCounter = 0;
		}
		return ++this.idCounter;
	}
}

/**
 * Is the object Promise?
 * @param obj Object to check.
 * @returns True for Promise.
 */
function isPromise(obj: any): boolean {
	// If BLUEBIRD is a valid environment, INSTANCEOF can not be determined correctly only
	// https://stackoverflow.com/questions/27746304/how-do-i-tell-if-an-object-is-a-promise
	return obj instanceof Promise || (obj && typeof obj.then === 'function');
}
