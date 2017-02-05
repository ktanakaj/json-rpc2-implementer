"use strict";
const const_1 = require("./const");
const error_1 = require("./error");
let idCounter = 0;
function createRequest(method, params, id) {
    if (id === null || id === undefined) {
        id = ++idCounter;
    }
    else if (typeof (id) !== "number") {
        id = String(id);
    }
    return { jsonrpc: const_1.VERSION, method: method, params: params, id: id };
}
exports.createRequest = createRequest;
function createNotification(method, params) {
    return { jsonrpc: const_1.VERSION, method: method, params: params };
}
exports.createNotification = createNotification;
function parseResponse(message) {
    let res;
    try {
        res = JSON.parse(message);
    }
    catch (e) {
        throw new error_1.JsonRpcError(error_1.ErrorCode.ParseError);
    }
    if (res === null || typeof res !== 'object') {
        throw new error_1.JsonRpcError(error_1.ErrorCode.ParseError);
    }
    return res;
}
exports.parseResponse = parseResponse;
//# sourceMappingURL=caller.js.map