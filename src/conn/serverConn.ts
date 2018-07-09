import {ConnHolder} from "./ConnHolder";
import * as ws from "ws";
import { StartServerFake, CreateConnToServerFake, simulateNetwork } from "./fakes/wsFakes";
import { createServer } from "http";


export function StartServer(port: number, onConn: (conn: Conn) => void): void {
    if(NODE) {
        if(TEST) {
            return StartServerFake(port, onConn);
        }

        // I think the server just ignores CORS? It was complaining before, but isn't now... Which should be fine,
        //  security should be done on a per connection basis, not with cookies? Or maybe... it is safer to use cookies?
        let wsServer = new ws.Server({ port });
        wsServer.on("listening", () => {
            console.log(`Started listening on ${port}`)
        });
        wsServer.on("connection", connRaw => {
            console.log("Server received a new connection");
            let conn = CreateServerConn(connRaw);
            onConn(conn);
        });

        wsServer.on("error", (err) => {
            console.error(err);
        });
        return;
    }
    throw new Error(`Tried to start websocket server in browser.`);
}

function CreateServerConn(ws: ws): Conn {
    let conn = new ConnHolder(
        data => ws.send(JSON.stringify(data)),
        buf => ws.send(buf),
        () => ws.close(),
        () => ws.readyState === ws.CLOSED || ws.readyState === ws.CLOSING,
        undefined,
        ws.readyState === ws.OPEN
    );

    ws.on("open", () => {
        conn._OnOpen();
    });
    ws.on("close", () => {
        conn._OnClose();
    });
    ws.on("message", (data) => {
        if(data instanceof Buffer) {
            conn._OnMessage(data);
        } else if(typeof data !== "string") {
            throw new Error("Received message with type other than string, type was " + typeof data);
        } else {
            conn._OnMessage(JSON.parse(data));
        }
    });
    ws.on("error", err => {
        console.error(err);
    });

    return conn;
}

interface ThrottleInfo {
    latencyMs: number;
    kbPerSecond: number;
}
let throttleInfo: ThrottleInfo|null = null;
export function ThrottleConnections(newThrottleInfo: ThrottleInfo, code: () => void) {
    let prevThrottleInfo = throttleInfo;
    try {
        throttleInfo = newThrottleInfo;
        code();
    } finally {
        throttleInfo = prevThrottleInfo;
    }
}


export function CreateConnToServer(url: string): Conn {
    if(TEST) {
        return CreateConnToServerFake(url);
    }

    function isWebsocket(ws: ws|WebSocket): ws is WebSocket {
        return !NODE;
    }
    let rawConn = NODE ? new ws(url) : new WebSocket(url);
    function sendBase(data: string|Buffer) {
        if(isWebsocket(rawConn)) {
            rawConn.send(data);
        } else {
            rawConn.send(data);
        }
    }

    let send = (data: string|Buffer) => sendBase(data);

    if(throttleInfo !== null) {
        let info = throttleInfo;
        let msPerByte = 1 / (info.kbPerSecond * 1024 / 1000);
        console.log(`Creating throttled connection. ${msPerByte} milliseconds per byte, ${info.latencyMs} ms latency.`);
        send = simulateNetwork<string|Buffer>(
            sendBase,
            err => {
                console.error("Network err", err);
            },
            info.latencyMs,
            msPerByte,
            x => x.length
        );
    }


    let conn = new ConnHolder(
        data => send(JSON.stringify(data)),
        buf => send(buf),
        () => rawConn.close(),
        () => rawConn.readyState === rawConn.CLOSED || rawConn.readyState === rawConn.CLOSING,
        undefined,
        false
    );

    if(isWebsocket(rawConn)) {
        rawConn.onopen = () => {
            conn._OnOpen();
        };
        rawConn.onclose = () => {
            conn._OnClose();
        };
        rawConn.onmessage = (ev) => {
            let data = ev.data;
            if(data instanceof Buffer) {
                conn._OnMessage(data);
            } else if(typeof data !== "string") {
                throw new Error("Received message with type other than string, type was " + typeof data);
            } else {
                conn._OnMessage(JSON.parse(data));
            }
        };
    } else {
        rawConn.on("open", () => {
            conn._OnOpen();
        });
        rawConn.on("close", () => {
            conn._OnClose();
        });
        rawConn.on("message", (data) => {
            if(data instanceof Buffer) {
                conn._OnMessage(data);
            } else if(typeof data !== "string") {
                throw new Error("Received message with type other than string, type was " + typeof data);
            } else {
                conn._OnMessage(JSON.parse(data));
            }
        });
    }

    return conn;
}