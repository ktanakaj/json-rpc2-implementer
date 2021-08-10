"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JsonRpc2Implementer = exports.NoResponse = exports.JsonRpcError = exports.ErrorCode = exports.VERSION = void 0;
exports.VERSION = "2.0";
var ErrorCode;
(function (ErrorCode) {
    ErrorCode[ErrorCode["ParseError"] = -32700] = "ParseError";
    ErrorCode[ErrorCode["InvalidRequest"] = -32600] = "InvalidRequest";
    ErrorCode[ErrorCode["MethodNotFound"] = -32601] = "MethodNotFound";
    ErrorCode[ErrorCode["InvalidParams"] = -32602] = "InvalidParams";
    ErrorCode[ErrorCode["InternalError"] = -32603] = "InternalError";
})(ErrorCode = exports.ErrorCode || (exports.ErrorCode = {}));
const ServerErrorSince = -32000;
const ServerErrorUntil = -32099;
const MAX_INT32 = 2147483647;
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
exports.NoResponse = Symbol('NoResponse');
class JsonRpc2Implementer {
    constructor() {
        this.timeout = 60000;
        this.idCounter = 0;
        this.callbackMap = new Map();
    }
    call(method, params, id) {
        return __awaiter(this, void 0, void 0, function* () {
            const self = this;
            return new Promise((resolve, reject) => {
                const req = this.createRequest(method, params, id);
                this.callbackMap.set(req.id, { resolve: resolve, reject: reject });
                try {
                    const result = this.sender(JSON.stringify(req));
                    if (isPromise(result)) {
                        result.catch(removeIdAndReject);
                    }
                    if (this.timeout > 0) {
                        setTimeout(() => {
                            if (this.callbackMap.has(req.id)) {
                                const e = new Error(`RPC response timeouted. (${JSON.stringify(req)})`);
                                e.name = "TimeoutError";
                                removeIdAndReject(e);
                            }
                        }, this.timeout);
                    }
                }
                catch (e) {
                    removeIdAndReject(e);
                }
                function removeIdAndReject(e) {
                    self.callbackMap.delete(req.id);
                    reject(e);
                }
            });
        });
    }
    notice(method, params) {
        return __awaiter(this, void 0, void 0, function* () {
            const req = this.createNotification(method, params);
            const result = this.sender(JSON.stringify(req));
            if (isPromise(result)) {
                yield result;
            }
        });
    }
    receive(message) {
        return __awaiter(this, void 0, void 0, function* () {
            let res;
            try {
                res = yield this.doMetodOrCallback(this.parse(message));
            }
            catch (e) {
                res = this.createResponse(null, null, e);
            }
            if (res) {
                const result = this.sender(JSON.stringify(res));
                if (isPromise(result)) {
                    yield result;
                }
            }
        });
    }
    doMetodOrCallback(json) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!Array.isArray(json)) {
                if (this.isResponse(json)) {
                    this.doCallback(json);
                }
                else {
                    return this.doMethod(json);
                }
            }
            else {
                const responses = [];
                for (let j of json) {
                    if (this.isResponse(j)) {
                        this.doCallback(j);
                    }
                    else {
                        const res = yield this.doMethod(j);
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
    doMethod(request) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!this.methodHandler) {
                    throw new JsonRpcError(ErrorCode.MethodNotFound);
                }
                let result = this.methodHandler(request.method, request.params, request.id);
                if (isPromise(result)) {
                    result = yield result;
                }
                if (result !== exports.NoResponse && request.id !== undefined && request.id !== null) {
                    return this.createResponse(request.id, result);
                }
            }
            catch (e) {
                return this.createResponse(request.id, null, e);
            }
            return null;
        });
    }
    doCallback(response) {
        const cb = this.callbackMap.get(response.id);
        if (!cb) {
            return;
        }
        this.callbackMap.delete(response.id);
        if (response.error) {
            cb.reject(new JsonRpcError(response.error.code, response.error.message, response.error.data));
        }
        else {
            cb.resolve(response.result);
        }
    }
    createRequest(method, params, id) {
        if (id === null || id === undefined) {
            id = this.generateId();
        }
        else if (typeof (id) !== "number") {
            id = String(id);
        }
        return { jsonrpc: exports.VERSION, method: method, params: params, id: id };
    }
    createResponse(id, result, error) {
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
    createNotification(method, params) {
        return { jsonrpc: exports.VERSION, method: method, params: params };
    }
    parse(message) {
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
    isResponse(json) {
        return json.result !== undefined || json.error !== undefined;
    }
    generateId() {
        if (this.idCounter >= MAX_INT32) {
            this.idCounter = 0;
        }
        return ++this.idCounter;
    }
}
exports.JsonRpc2Implementer = JsonRpc2Implementer;
function isPromise(obj) {
    return obj instanceof Promise || (obj && typeof obj.then === 'function');
}
//# sourceMappingURL=index.js.map