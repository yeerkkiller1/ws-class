import {ConnHolder} from "./ConnHolder";
import * as ws from "ws";
import { StartServerFake, CreateConnToServerFake, simulateNetwork } from "./fakes/wsFakes";


export function StartServer(port: number, onConn: (conn: Conn) => void): void {
    if(NODE_CONSTANT) {
        if(TEST) {
            return StartServerFake(port, onConn);
        }
        let wsServer = new ws.Server({ port: port });
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
    if(NODE_CONSTANT) {
        if(TEST) {
            return CreateConnToServerFake(url);
        }
        let rawConn = new ws(url);

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

        function sendBase(data: string|Buffer) {
            rawConn.send(data);
        }

        let conn = new ConnHolder(
            data => send(JSON.stringify(data)),
            buf => send(buf),
            () => rawConn.close(),
            () => rawConn.readyState === rawConn.CLOSED || rawConn.readyState === rawConn.CLOSING,
            undefined,
            false
        );

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

        return conn;
    }
    throw new Error("Calling server-side code on the client");
}