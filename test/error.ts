/**
 * @file error.tsのテスト。
 */
import * as assert from 'power-assert';
import { JsonRpcError, ErrorCode, toResponseError } from '../lib/error';

describe('error', () => {
	describe('JsonRpcError#toJSON()', () => {
		it('should return converted JSON object', function () {
			const e = new JsonRpcError();
			assert.deepStrictEqual(JSON.stringify(e), JSON.stringify({ code: ErrorCode.InternalError, message: "Internal error" }));
		});
	});
});