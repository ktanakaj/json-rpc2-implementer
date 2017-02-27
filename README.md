# json-rpc2-implementer
[![NPM](https://nodei.co/npm/json-rpc2-implementer.png?downloads=true)](https://nodei.co/npm/json-rpc2-implementer/)
[![Build Status](https://travis-ci.org/ktanakaj/json-rpc2-implementer.svg?branch=master)](https://travis-ci.org/ktanakaj/json-rpc2-implementer)
[![MIT License](http://img.shields.io/badge/license-MIT-blue.svg?style=flat)](LICENSE)

This is [JSON-RPC 2.0](http://www.jsonrpc.org/specification) server and client JavaScript/TypeScript implementation. json-rpc2-implementer is only formatter, parser, and wrapper. It is not included any HTTP, TCP and WebSocket endpoints.

## Install
To install json-rpc2-implementer in the current directory, run:

    npm install json-rpc2-implementer

## Usage
You must integrate json-rpc2-implementer to your application. But you can integrate every HTTP server, WebSocket server and other application.

    import * as WebSocket from 'ws';
    import { JsonRpc2Implementer } from 'json-rpc2-implementer';

    const WebSocketServer = WebSocket.Server;
    const wss = new WebSocketServer({ port: 3000 });
    wss.on('connection', async function (ws: WebSocket) {
    	const rpc = new JsonRpc2Implementer();
    	rpc.sender = (message) => ws.send(message);
    	rpc.methodHandler = (method: string, params: any) => {
    		console.log(`CALLED method=${method},params=${params}`);
    		return `Hello JSON-RPC2 method=${method},params=${params}`;
    	};

    	ws.on('message', (message) => rpc.receive(message));

    	const result = await rpc.call('hello', { key: 1 });
    	console.log(result);
    });

When you use json-rpc2-implementer for wrapper, you must set `sender` and `methodHandler` properties and create function for call to `receive()`.

## API

### Class: JsonRpc2Implementer
#### rpc.call(method[, params, id])
* `method` {String} The method name to call.
* `params` {Any} The parameters for the method. `params` will be conveted by `JSON.stringify()`.
* `id` {Number|String} The id for JSON-RPC request. Defaults to serial number by generated in each instances.

Call to the remote procedure by `sender` and `receive()`. `call()` wait the response from the procedure and return `Promise.<Any>` included the result.

ATTENTION: `call()` check timeout at response. If the request timeouted, `call()` reject `TimeoutError`. But the receiver's status is uncertain.

#### rpc.notice(method[, params])
* `method` {String} The method name to call.
* `params` {Any} The parameters for the method. `params` will be conveted by `JSON.stringify()`.

Notice to the remote procedure by `sender`. `notice()` return `Promise.<void>` but it doesn't wait the response.

#### rpc.receive(message)
* `message` {String} The received message.

Receive a JSON-RPC request/response and call to `methodHandler` and return response by `sender`. `receive()` return `Promise.<void>` for send a response from `methodHandler`.

`receive()` also support batch request/response.

ATTENTION: `receive()` don't check `jsonrpc` property in the request/response. It is lazy receiver.

#### rpc.createRequest(method[, params, id])
* `method` {String} The method name to call.
* `params` {Any} The parameters for the method. `params` will be conveted by `JSON.stringify()`.
* `id` {Number|String} The id for JSON-RPC request. Defaults to serial number by generated each instances.

Create a JSON-RPC2 request object. 

#### rpc.createResponse(id, result[, error])
* `id` {Number|String} The id that JSON-RPC request specified.
* `result` {Any} The result from a local procedure. `result` will be conveted by `JSON.stringify()`.
* `error` {Any} The error from a local procedure when an error occurs. `error` will be converted by `JsonRpcError.convert()`.

Create a JSON-RPC2 response object. 

#### rpc.createNotification(method[, params])
* `method` {String} The method name to call.
* `params` {Any} The parameters for the method. `params` will be conveted by `JSON.stringify()`.

Create a JSON-RPC2 notification request object. 

#### rpc.parse(message)
* `message` {String} The received message.

Parse a JSON-RPC request/response.

#### rpc.sender
* {Function}

The message sender for a JSON-RPC request/response from `call()`, `notice()` and `receive()`.
The first argument of the sender must be string and send it to the server.

#### rpc.methodHandler
* {Function}

The method handler would be call from `receive()` when a JSON-RPC request received.
The first argument of the handler must be any parameters for a JSON-RPC request's `params`.
And also the second argument can be a ID for the request's `id`.

The result of the handler would be used to the response's `result`.
If the handler throw error, `receive()` send an error response.

The handler can return the paramters that both generally value and `Promise`.

#### rpc.timeout
* {Number}

The timeout specify timeout wait msec for `call()`.
Defaults to 60000 ms.

### Class: JsonRpcError
#### new JsonRpcError([code, message, data])
* `code` {Number} The error code for a response. Defaults to `ErrorCode.InternalError`.
* `message` {String} The error message for a response. Defaults to the assigned message each error code constants or "Unknown Error".
* `data` {Any} The option data for a response.

Create a new error instance.

#### error.toJSON()
Create a new error object for a JSON-RPC2 response.

#### JsonRpcError.convert(error)
* `error` {Any} The error instance for a response.

Create a new `JsonRpcError` error instance from other Error.

### ErrorCode constants

|Constant       | Value      | Description                                      |
|---------------|------------|--------------------------------------------------|
|ParseError     | -32700     | The message can't be parsed.                     |
|InvalidRequest | -32600     | The message is not JSON-RPC2 format.             |
|MethodNotFound | -32601     | The specified method is not found.               |
|InvalidParams  | -32602     | The request parameter is invalid.                |
|InternalError  | -32603     | Internal error.                                  |

There are only few error codes that JSON-RPC2 specified [here](http://www.jsonrpc.org/specification#error_object).
You can use other error code for your application.

## Example
You can find a example web application here.

* [ktanakaj/ws-chat-sample](https://github.com/ktanakaj/ws-chat-sample)

## License
[MIT](https://github.com/ktanakaj/json-rpc2-implementer/blob/master/LICENSE)
