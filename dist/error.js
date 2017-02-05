"use strict";
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
        this.name = 'JsonRpcError';
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
            if (error['code']) {
                json.code = error['code'];
            }
            if (error['message']) {
                json.message = error['message'];
            }
            if (error['data']) {
                json.data = error['data'];
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
            return 'Parse error';
        case ErrorCode.InvalidRequest:
            return 'Invalid Request';
        case ErrorCode.MethodNotFound:
            return 'Method not found';
        case ErrorCode.InvalidParams:
            return 'Invalid params';
        case ErrorCode.InternalError:
            return 'Internal error';
    }
    if (code >= -32000 && code <= -32099) {
        return 'Server error';
    }
    return 'Unknown Error';
}
//# sourceMappingURL=error.js.map