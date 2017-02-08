"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
exports.VERSION = "2.0";
var ErrorCode;
(function (ErrorCode) {
    ErrorCode[ErrorCode["ParseError"] = -32700] = "ParseError";
    ErrorCode[ErrorCode["InvalidRequest"] = -32600] = "InvalidRequest";
    ErrorCode[ErrorCode["MethodNotFound"] = -32601] = "MethodNotFound";
    ErrorCode[ErrorCode["InvalidParams"] = -32602] = "InvalidParams";
    ErrorCode[ErrorCode["InternalError"] = -32603] = "InternalError";
})(ErrorCode = exports.ErrorCode || (exports.ErrorCode = {}));
;
const ServerErrorSince = -32000;
const ServerErrorUntil = -32099;
class JsonRpcError extends Error {
    constructor(code = ErrorCode.InternalError, message, data) {
        super(message || makeDefaultErrorMessage(code));
        this.name = "JsonRpcError";
        this.code = code;
        this.data = data;
    }
    toJSON() {
        const json = {
            code: Number(this.code),
            message: String(this.message),
        };
        if (this.data !== undefined) {
            json.data = this.data;
        }
        return json;
    }
    static convert(error) {
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
        }
        else {
            json.message = String(error);
        }
        return json;
    }
}
exports.JsonRpcError = JsonRpcError;
function makeDefaultErrorMessage(code) {
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
let idCounter = 0;
const callbackMap = new Map();
function call(method, params, sender) {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise((resolve, reject) => {
            const req = createRequest(method, params);
            callbackMap.set(req.id, { resolve: resolve, reject: reject });
            try {
                const result = sender(req);
                if (result instanceof Promise) {
                    result.catch((e) => {
                        callbackMap.delete(req.id);
                        reject(e);
                    });
                }
            }
            catch (e) {
                callbackMap.delete(req.id);
                reject(e);
            }
        });
    });
}
exports.call = call;
function notice(method, params, sender) {
    return __awaiter(this, void 0, void 0, function* () {
        const req = createNotification(method, params);
        const result = sender(req);
        if (result instanceof Promise) {
            yield result;
        }
    });
}
exports.notice = notice;
function receive(message, methodHandler) {
    return __awaiter(this, void 0, void 0, function* () {
        let json;
        try {
            json = parse(message);
        }
        catch (e) {
            return createResponse(null, null, e);
        }
        if (!Array.isArray(json)) {
            if (isResponse(json)) {
                doCallback(json);
            }
            else {
                return doMethod(json, methodHandler);
            }
        }
        else {
            const responses = [];
            for (let j of json) {
                if (isResponse(j)) {
                    doCallback(j);
                }
                else {
                    const res = yield doMethod(j, methodHandler);
                    if (res) {
                        responses.push(res);
                    }
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
function doCallback(response) {
    const cb = callbackMap.get(response.id);
    if (!cb) {
        return;
    }
    callbackMap.delete(response.id);
    if (response.error) {
        cb.reject(new JsonRpcError(response.error.code, response.error.message, response.error.data));
    }
    else {
        cb.resolve(response.result);
    }
}
function isResponse(json) {
    return json.result !== undefined || json.error !== undefined;
}
function createRequest(method, params, id) {
    if (id === null || id === undefined) {
        id = ++idCounter;
    }
    else if (typeof (id) !== "number") {
        id = String(id);
    }
    return { jsonrpc: exports.VERSION, method: method, params: params, id: id };
}
exports.createRequest = createRequest;
function createResponse(id, result, error) {
    if (id === undefined || id === null) {
        id = null;
    }
    else if (typeof (id) !== "number") {
        id = String(id);
    }
    const res = { jsonrpc: exports.VERSION, id: id };
    if (error) {
        if (!(error instanceof JsonRpcError)) {
            error = JsonRpcError.convert(error);
        }
        res.error = error;
    }
    else {
        res.result = result || null;
    }
    return res;
}
exports.createResponse = createResponse;
function createNotification(method, params) {
    return { jsonrpc: exports.VERSION, method: method, params: params };
}
exports.createNotification = createNotification;
function parse(message) {
    let json;
    try {
        json = JSON.parse(message);
    }
    catch (e) {
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
exports.parse = parse;
function parseRequest(message) {
    return parse(message);
}
exports.parseRequest = parseRequest;
function parseResponse(message) {
    let res;
    try {
        res = JSON.parse(message);
    }
    catch (e) {
        throw new JsonRpcError(ErrorCode.ParseError);
    }
    if (res === null || typeof res !== "object") {
        throw new JsonRpcError(ErrorCode.ParseError);
    }
    return res;
}
exports.parseResponse = parseResponse;
//# sourceMappingURL=index.js.map