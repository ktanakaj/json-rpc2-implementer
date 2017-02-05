/**
 * @file callee.tsのテスト。
 */
import * as assert from 'power-assert';
import { JsonRpc2Response } from '../lib/const';
import { ErrorCode } from '../lib/error';
import { receive, parseRequest, createResponse } from '../lib/callee';

describe('callee', () => {
	describe('#receive()', () => {
		it('should call methodHandler', async function () {
			let request;
			const response = await receive('{"jsonrpc": "2.0", "method": "subtract", "params": [42, 23], "id": 1}', (req) => {
				request = req;
				return "test";
			})
			assert.deepStrictEqual(request, { jsonrpc: "2.0", method: "subtract", params: [42, 23], id: 1 });
			assert.deepStrictEqual(response, { jsonrpc: "2.0", result: "test", id: 1 });
		});

		it('should batch call methodHandler', async function () {
			const requests = [];
			const responses = await receive('[{"jsonrpc": "2.0", "method": "sum", "params": [1,2,4], "id": "1"},{"jsonrpc": "2.0", "method": "notify_hello", "params": [7]}]', (req) => {
				requests.push(req);
				return "test" + req.method;
			})
			assert.deepStrictEqual(requests, [
				{ jsonrpc: "2.0", method: "sum", params: [1, 2, 4], id: "1" },
				{ jsonrpc: "2.0", method: "notify_hello", params: [7] },
			]);
			assert.deepStrictEqual(responses, [{ jsonrpc: "2.0", result: "testsum", id: "1" }]);
		});

		it('should return error when parse failed', async function () {
			const response = <JsonRpc2Response>await receive('{"jsonrpc": ', (req) => { });
			assert.strictEqual(response.jsonrpc, "2.0")
			assert.strictEqual(response.error.code, ErrorCode.ParseError);
			assert.strictEqual(response.error.message, "Parse error");
			assert.strictEqual(response.id, null);
		});
	});
});