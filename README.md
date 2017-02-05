# json-rpc2-implementer
This is JSON-RPC 2.0 server and client implementation. json-rpc2-implementer is only formatter, parser, and receiver. It is not included any HTTP, TCP and WebSocket endpoints.

## Usage
You must integrate json-rpc2-implementer to your application. But you can integrate every HTTP server, WebSocket server and other application.

    import * as WebSocket from 'ws';
    import * as jsonRpc2 from 'json-rpc2-implementer';

    const WebSocketServer = WebSocket.Server;
    const wss = new WebSocketServer({ port: 3000 });
    wss.on('connection', function (ws: WebSocket) {
    	ws.on('message', async function (message: string) {
    		const res = await jsonRpc2.receive(message, function (method: string, params: any) {
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
