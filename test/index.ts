/**
 * @file test for index.ts。
 */
import * as assert from "power-assert";
import { VERSION, JsonRpcError, ErrorCode, JsonRpc2Implementer, NoResponse } from "../";

describe("JsonRpcError", () => {
	describe("#toJSON()", () => {
		it("should return converted JSON object", function () {
			const e = new JsonRpcError();
			assert.deepStrictEqual(JSON.stringify(e), JSON.stringify({ code: ErrorCode.InternalError, message: "Internal error" }));
		});
	});
});

describe("JsonRpc2Implementer", () => {
	const rpc = new JsonRpc2Implementer();
	rpc.timeout = 200;

	describe("#call()", () => {
		it("should call sender and callback", async function () {
			let request;
			rpc.sender = (msg) => {
				// The receive method is called outside the library. Call manually for unit test.
				// 実際は外部からreceiveが呼ばれるので、ここでは手動でコール。
				request = JSON.parse(msg);
				return rpc.receive(`{"jsonrpc": "2.0", "result": 19, "id": ${request.id}}`);
			};
			const result = await rpc.call('subtract', [42, 23]);
			assert.strictEqual(request.jsonrpc, VERSION);
			assert.strictEqual(request.method, "subtract");
			assert.deepStrictEqual(request.params, [42, 23]);
			assert(request.id > 0);
			assert.deepStrictEqual(result, 19);
		});

		it("should call sender and callback with id=string", async function () {
			const id = 'UNITTEST1';
			let request;
			rpc.sender = (msg) => {
				// The receive method is called outside the library. Call manually for unit test.
				// 実際は外部からreceiveが呼ばれるので、ここでは手動でコール。
				request = JSON.parse(msg);
				return rpc.receive(`{"jsonrpc": "2.0", "result": 19, "id": "${request.id}"}`);
			};
			const result = await rpc.call('subtract', [42, 23], id);
			assert.strictEqual(request.jsonrpc, VERSION);
			assert.strictEqual(request.method, "subtract");
			assert.deepStrictEqual(request.params, [42, 23]);
			assert.strictEqual(id, request.id);
			assert.deepStrictEqual(result, 19);
		});

		it("should call sender and callback with id=0", async function () {
			let request;
			rpc.sender = (msg) => {
				// The receive method is called outside the library. Call manually for unit test.
				// 実際は外部からreceiveが呼ばれるので、ここでは手動でコール。
				request = JSON.parse(msg);
				return rpc.receive(`{"jsonrpc": "2.0", "result": 19, "id": ${request.id}}`);
			};
			const result = await rpc.call('subtract', [42, 23], 0);
			assert.strictEqual(request.jsonrpc, VERSION);
			assert.strictEqual(request.method, "subtract");
			assert.deepStrictEqual(request.params, [42, 23]);
			assert.strictEqual(0, request.id);
			assert.deepStrictEqual(result, 19);
		});

		it("should call sender and throw error", async function () {
			let request;
			rpc.sender = (msg) => {
				// The receive method is called outside the library. Call manually for unit test.
				// 実際は外部からreceiveが呼ばれるので、ここでは手動でコール。
				request = JSON.parse(msg);
				return rpc.receive(`{"jsonrpc": "2.0", "error": {"code": -32601, "message": "Method not found"}, "id": ${request.id}}`);
			};
			try {
				await rpc.call('foobar');
				assert.fail();
			} catch (e) {
				assert.strictEqual(request.jsonrpc, VERSION);
				assert.strictEqual(request.method, "foobar");
				assert.strictEqual(request.params, undefined);
				assert(request.id > 0);
				assert(e instanceof JsonRpcError);
				assert.strictEqual(e.code, -32601);
				assert.strictEqual(e.message, "Method not found");
			}
		});

		it("should throw error when timeout", async function () {
			let request;
			rpc.sender = (msg) => {
				// * return invalid Promise that don't call resolve.
				// ※ resolveを呼ばない終わらないPromiseを返す
				request = JSON.parse(msg);
				return new Promise((resolve) => { });
			};
			try {
				await rpc.call('subtract', [42, 23]);
				assert.fail();
			} catch (e) {
				assert.strictEqual(request.jsonrpc, VERSION);
				assert.strictEqual(request.method, "subtract");
				assert.deepStrictEqual(request.params, [42, 23]);
				assert(request.id > 0);
				assert(e instanceof Error);
				assert.strictEqual(e.name, 'TimeoutError');
				assert.strictEqual(e.message, `RPC response timeouted. (${JSON.stringify(request)})`);
			}
		});

		it("should throw error when sender throw Error", async function () {
			rpc.sender = (msg) => {
				throw new Error("test error");
			};
			try {
				await rpc.call('subtract', [42, 23]);
				assert.fail();
			} catch (e) {
				assert(e instanceof Error);
				assert.strictEqual(e.message, 'test error');
			}
		});

		it("should throw error when sender return Promise.reject", async function () {
			rpc.sender = (msg) => {
				return Promise.reject("test error");
			};
			try {
				await rpc.call('subtract', [42, 23]);
				assert.fail();
			} catch (e) {
				assert.strictEqual(e, 'test error');
			}
		});
	});

	describe("#notice()", () => {
		it("should call sender", async function () {
			let request;
			rpc.sender = (msg) => {
				request = JSON.parse(msg);
			};
			const response = await rpc.notice('update', [1, 2, 3, 4, 5]);
			assert.deepStrictEqual(request, { jsonrpc: VERSION, method: "update", params: [1, 2, 3, 4, 5] });
		});

		it("should throw error when sender throw Error", async function () {
			rpc.sender = (msg) => {
				throw new Error("test error");
			};
			try {
				await rpc.notice('update', [1, 2, 3, 4, 5]);
				assert.fail();
			} catch (e) {
				assert(e instanceof Error);
				assert.strictEqual(e.message, 'test error');
			}
		});

		it("should throw error when sender return Promise.reject", async function () {
			rpc.sender = (msg) => {
				return Promise.reject("test error");
			};
			try {
				await rpc.notice('update', [1, 2, 3, 4, 5]);
				assert.fail();
			} catch (e) {
				assert.strictEqual(e, 'test error');
			}
		});
	});

	describe("#receive()", () => {
		it("should call methodHandler", async function () {
			let response, method, params, id;
			rpc.sender = (msg) => {
				response = JSON.parse(msg);
			};
			rpc.methodHandler = (m, p, i) => {
				method = m;
				params = p;
				id = i;
				return "test";
			};
			await rpc.receive('{"jsonrpc": "2.0", "method": "subtract", "params": [42, 23], "id": 1}');
			assert.deepStrictEqual(response, { jsonrpc: VERSION, result: "test", id: 1 });
			assert.strictEqual(method, "subtract");
			assert.deepStrictEqual(params, [42, 23]);
			assert.strictEqual(id, 1);
		});

		it("should batch call methodHandler", async function () {
			let responses;
			let methodArray = [];
			let paramsArray = [];
			let idArray = [];
			rpc.sender = (msg) => {
				responses = JSON.parse(msg);
			};
			rpc.methodHandler = (m, p, i) => {
				methodArray.push(m);
				paramsArray.push(p);
				idArray.push(i);
				return "test" + m;
			};
			await rpc.receive('[{"jsonrpc": "2.0", "method": "sum", "params": [1,2,4], "id": "1"},{"jsonrpc": "2.0", "method": "notify_hello", "params": [7]}]');
			assert.deepStrictEqual(responses, [{ jsonrpc: VERSION, result: "testsum", id: "1" }]);
			assert.deepStrictEqual(methodArray, ["sum", "notify_hello"]);
			assert.deepStrictEqual(paramsArray, [[1, 2, 4], [7]]);
			assert.deepStrictEqual(idArray, ["1", undefined]);
		});

		it("should return error when parse failed", async function () {
			let response;
			rpc.sender = (msg) => {
				response = JSON.parse(msg);
			};
			await rpc.receive('{"jsonrpc": ');
			assert.strictEqual(response.jsonrpc, VERSION);
			assert.strictEqual(response.error.code, ErrorCode.ParseError);
			assert.strictEqual(response.error.message, "Parse error");
			assert.strictEqual(response.id, null);
		});

		it("should return result when methodHandler return Promise.resolve", async function () {
			let response;
			rpc.sender = (msg) => {
				response = JSON.parse(msg);
			};
			rpc.methodHandler = (m, p, i) => {
				return new Promise((resolve) => {
					setTimeout(() => resolve(`${m} done!`), 100);
				});
			};
			await rpc.receive('{"jsonrpc": "2.0", "method": "longwork", "id": 1}');
			assert.deepStrictEqual(response, { jsonrpc: VERSION, result: "longwork done!", id: 1 });
		});

		it("should return error when methodHandler return Promise.reject", async function () {
			let response;
			rpc.sender = (msg) => {
				response = JSON.parse(msg);
			};
			rpc.methodHandler = (m, p, i) => {
				return new Promise((resolve, reject) => {
					setTimeout(() => reject(`${m} error!`), 100);
				});
			};
			await rpc.receive('{"jsonrpc": "2.0", "method": "longwork", "id": 1}');
			assert.strictEqual(response.jsonrpc, VERSION);
			assert.strictEqual(response.error.code, ErrorCode.InternalError);
			assert.strictEqual(response.error.message, "longwork error!");
			assert.strictEqual(response.id, 1);
		});

		it("should return error when methodHandler throw error", async function () {
			let response;
			rpc.sender = (msg) => {
				response = JSON.parse(msg);
			};
			rpc.methodHandler = (m, p, i) => {
				throw new Error(`${m} error!`);
			};
			await rpc.receive('{"jsonrpc": "2.0", "method": "test", "id": 1}');
			assert.strictEqual(response.jsonrpc, VERSION);
			assert.strictEqual(response.error.code, ErrorCode.InternalError);
			assert.strictEqual(response.error.message, "test error!");
			assert.strictEqual(response.id, 1);
		});

		it("should't return anything when methodHandler return NoResponse", async function () {
			rpc.sender = (msg) => {
				assert(false, 'sender called!');
			};
			rpc.methodHandler = (m, p, i) => {
				return NoResponse;
			};
			await rpc.receive('{"jsonrpc": "2.0", "method": "test", "id": 1}');
		});
	});

	describe("#createResponse()", () => {
		it("should return null result", async function () {
			assert.deepStrictEqual(rpc.createResponse(20, null), { jsonrpc: VERSION, result: null, id: 20 });
			assert.deepStrictEqual(rpc.createResponse("test", undefined), { jsonrpc: VERSION, result: null, id: "test" });
		});
	});
});
