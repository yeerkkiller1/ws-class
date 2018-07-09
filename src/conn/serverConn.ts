import {ConnHolder} from "./ConnHolder";
import * as ws from "ws";
import { StartServerFake, CreateConnToServerFake, simulateNetwork } from "./fakes/wsFakes";
import { createServer } from "http";
import { createPromiseStream } from "../controlFlow/promise";


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
    function sendBase(data: string|Uint8Array) {
        if(isWebsocket(rawConn)) {
            rawConn.send(data);
        } else {
            rawConn.send(data);
        }
    }

    let send = (data: string|Uint8Array) => sendBase(data);

    if(throttleInfo !== null) {
        let info = throttleInfo;
        let msPerByte = 1 / (info.kbPerSecond * 1024 / 1000);
        console.log(`Creating throttled connection. ${msPerByte} milliseconds per byte, ${info.latencyMs} ms latency.`);
        send = simulateNetwork<string|Uint8Array>(
            sendBase,
            err => {
                console.error("Network err", err);
            },
            info.latencyMs,
            msPerByte,
            x => typeof x === "string" ? x.length : x.byteLength
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
        let queue = createPromiseStream<Types.AnyAllNoObject | Uint8Array>();
        async function handleQueue() {
            while(true) {
                let item = await queue.getPromise();
                conn._OnMessage(item);
            }
        }
        handleQueue();
        rawConn.onmessage = (ev) => {
            let data = ev.data;
            
            if(data instanceof Blob) {
                let readDone = createPromiseStream<Uint8Array>();
                let reader = new FileReader();
                reader.onload = () => {
                    readDone.sendValue(new Uint8Array(reader.result as ArrayBuffer));
                };
                reader.readAsArrayBuffer(data);
                queue.sendValue(readDone.getPromise());
            } else if(typeof data !== "string") {
                throw new Error("Received message with type other than string, type was " + typeof data);
            } else {
                queue.sendValue(JSON.parse(data));
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