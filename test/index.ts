/**
 * @file index.tsのテスト。
 */
import * as assert from "power-assert";
import { JsonRpc2Response, VERSION, JsonRpcError, ErrorCode, call, notice, receive, parseRequest, createResponse } from "../";

describe("json-rpc2-implementer", () => {
	describe("JsonRpcError#toJSON()", () => {
		it("should return converted JSON object", function () {
			const e = new JsonRpcError();
			assert.deepStrictEqual(JSON.stringify(e), JSON.stringify({ code: ErrorCode.InternalError, message: "Internal error" }));
		});
	});

	describe("#call()", () => {
		it("should call sender and callback", async function () {
			let request;
			const response = await call('subtract', [42, 23], (req) => {
				request = req;
				// 実際は外部からreceiveが呼ばれるので、ここでは手動でコール
				receive(`{"jsonrpc": "2.0", "result": 19, "id": ${req.id}}`, (req) => {
					assert.fail();
				});
			});
			assert.strictEqual(request.jsonrpc, VERSION);
			assert.strictEqual(request.method, "subtract");
			assert.deepStrictEqual(request.params, [42, 23]);
			assert(request.id > 0);
			assert.deepStrictEqual(response, 19);
		});

		it("should call sender and throw error", async function () {
			let request;
			try {
				await call('foobar', undefined, (req) => {
					request = req;
					// 実際は外部からreceiveが呼ばれるので、ここでは手動でコール
					receive(`{"jsonrpc": "2.0", "error": {"code": -32601, "message": "Method not found"}, "id": ${req.id}}`, (req) => {
						assert.fail();
					});
				});
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
	});

	describe("#notice()", () => {
		it("should call sender", async function () {
			let request;
			const response = await notice('update', [1, 2, 3, 4, 5], (req) => {
				request = req;
			});
			assert.deepStrictEqual(request, { jsonrpc: VERSION, method: "update", params: [1, 2, 3, 4, 5] });
		});
	});

	describe("#receive()", () => {
		it("should call methodHandler", async function () {
			let request;
			const response = await receive('{"jsonrpc": "2.0", "method": "subtract", "params": [42, 23], "id": 1}', (req) => {
				request = req;
				return "test";
			});
			assert.deepStrictEqual(request, { jsonrpc: VERSION, method: "subtract", params: [42, 23], id: 1 });
			assert.deepStrictEqual(response, { jsonrpc: VERSION, result: "test", id: 1 });
		});

		it("should batch call methodHandler", async function () {
			const requests = [];
			const responses = await receive('[{"jsonrpc": "2.0", "method": "sum", "params": [1,2,4], "id": "1"},{"jsonrpc": "2.0", "method": "notify_hello", "params": [7]}]', (req) => {
				requests.push(req);
				return "test" + req.method;
			});
			assert.deepStrictEqual(requests, [
				{ jsonrpc: "2.0", method: "sum", params: [1, 2, 4], id: "1" },
				{ jsonrpc: "2.0", method: "notify_hello", params: [7] },
			]);
			assert.deepStrictEqual(responses, [{ jsonrpc: VERSION, result: "testsum", id: "1" }]);
		});

		it("should return error when parse failed", async function () {
			const response = <JsonRpc2Response>await receive('{"jsonrpc": ', (req) => { });
			assert.strictEqual(response.jsonrpc, VERSION);
			assert.strictEqual(response.error.code, ErrorCode.ParseError);
			assert.strictEqual(response.error.message, "Parse error");
			assert.strictEqual(response.id, null);
		});
	});
});