import {ConnHolder} from "./ConnHolder";
import * as ws from "ws";
import { StartServerFake, CreateConnToServerFake } from "./fakes/wsFakes";


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
    ws.on("message", (ev) => {
        if(typeof ev !== "string") {
            throw new Error("Received message with type other than string, type was " + typeof ev);
        } else {
            conn._OnMessage(JSON.parse(ev));
        }
    });
    ws.on("error", err => {
        console.error(err);
    });

    return conn;
}

export function CreateConnToServer(url: string): Conn {
    if(NODE_CONSTANT) {
        if(TEST) {
            return CreateConnToServerFake(url);
        }
        let rawConn = new ws(url);

        let conn = new ConnHolder(
            data => rawConn.send(JSON.stringify(data)),
            buf => rawConn.send(buf),
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
        rawConn.on("message", (ev) => {
            if(typeof ev !== "string") {
                throw new Error("Received message with type other than string, type was " + typeof ev);
            } else {
                conn._OnMessage(JSON.parse(ev));
            }
        });

        return conn;
    }
    throw new Error("Calling server-side code on the client");
}