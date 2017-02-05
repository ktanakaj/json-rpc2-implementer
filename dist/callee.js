"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const const_1 = require("./const");
const error_1 = require("./error");
function receive(message, methodHandler) {
    return __awaiter(this, void 0, void 0, function* () {
        let req;
        try {
            req = parseRequest(message);
        }
        catch (e) {
            return createResponse(null, null, e);
        }
        if (!Array.isArray(req)) {
            return doMethod(req, methodHandler);
        }
        else {
            const responses = [];
            for (let r of req) {
                const res = yield doMethod(r, methodHandler);
                if (res) {
                    responses.push(res);
                }
            }
            if (responses.length > 0) {
                return responses;
            }
        }
    });
}
exports.receive = receive;
function doMethod(request, methodHandler) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let result = methodHandler(request);
            if (result instanceof Promise) {
                result = yield result;
            }
            if (request.id !== undefined && request.id !== null) {
                return createResponse(request.id, result);
            }
        }
        catch (e) {
            return createResponse(request.id, null, e);
        }
        return null;
    });
}
function parseRequest(message) {
    let req;
    try {
        req = JSON.parse(message);
    }
    catch (e) {
        throw new error_1.JsonRpcError(error_1.ErrorCode.ParseError);
    }
    if (!(req instanceof Object)) {
        throw new error_1.JsonRpcError(error_1.ErrorCode.InvalidRequest);
    }
    if (Array.isArray(req) && req.length === 0) {
        throw new error_1.JsonRpcError(error_1.ErrorCode.InvalidRequest);
    }
    return req;
}
exports.parseRequest = parseRequest;
function createResponse(id, result, error) {
    if (id === undefined || id === null) {
        id = null;
    }
    else if (typeof (id) !== "number") {
        id = String(id);
    }
    const res = { jsonrpc: const_1.VERSION, id: id };
    if (error) {
        if (!(error instanceof error_1.JsonRpcError)) {
            error = error_1.JsonRpcError.convert(error);
        }
        res.error = error;
    }
    else if (result) {
        res.result = result;
    }
    return res;
}
exports.createResponse = createResponse;
//# sourceMappingURL=callee.js.map