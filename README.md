# json-rpc2-implementer
This is [JSON-RPC 2.0](http://www.jsonrpc.org/specification) server and client implementation. json-rpc2-implementer is only formatter, parser, and wrapper. It is not included any HTTP, TCP and WebSocket endpoints.

## Install
To install json-rpc2-implementer in the current directory, run:

    npm install jsonrpc2

## Usage
You must integrate json-rpc2-implementer to your application. But you can integrate every HTTP server, WebSocket server and other application.

    import * as WebSocket from 'ws';
    import * as jsonRpc2 from 'json-rpc2-implementer';

    const WebSocketServer = WebSocket.Server;
    const wss = new WebSocketServer({ port: 3000 });
    wss.on('connection', function (ws: WebSocket) {
    	ws.on('message', async function (message: string) {
    		const res = await jsonRpc2.receive(message, function (request: jsonRpc2.JsonRpc2Request) {
    			// Call the specified method
    			return "Hello";
    		});
    		if (res) {
    			ws.send(JSON.stringify(res));
    		}
    	});
    });

## License
[MIT](https://github.com/ktanakaj/json-rpc2-implementer/blob/master/LICENSE)
