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
    wss.on('connection', function (ws: WebSocket) {
    	const rpc = new JsonRpc2Implementer();
    	rpc.sender = (message) => ws.send(message);
    	rpc.methodHandler = (method: string, params: any) => {
    		console.log(`CALLED method=${method},params=${params}`);
    		return `Hello JSON-RPC2 method=${method},params=${params}`;
    	};

    	ws.on('message', (message) => rpc.receive(message));
    });

## License
[MIT](https://github.com/ktanakaj/json-rpc2-implementer/blob/master/LICENSE)
