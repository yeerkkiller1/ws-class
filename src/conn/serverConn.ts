import {ConnHolder} from "./ConnHolder";
import * as ws from "ws";

export function CreateServerConn(ws: ws): Conn {
    let conn = new ConnHolder(
        data => ws.send(JSON.stringify(data)),
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
        let rawConn = new ws(url);

        let conn = new ConnHolder(
            data => rawConn.send(JSON.stringify(data)),
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