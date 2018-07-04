import {ConnHolder} from "./ConnHolder";

export function CreateBrowserConn(url: string): Conn {
    let ws: WebSocket;
    let conn = new ConnHolder(
        packet => ws.send(JSON.stringify(packet)),
        buf => ws.send(buf),
        () => ws.close(),
        () => ws.readyState === ws.CLOSING || ws.readyState === ws.CLOSED,
        undefined,
        false
    );
    ws = new WebSocket(url + "?" + conn.GetLocalId());

    ws.onopen = () => {
        conn._OnOpen();
    };
    ws.onclose = () => {
        conn._OnClose();
    };
    ws.onmessage = (ev) => {
        if(ev.data instanceof Buffer) {
            conn._OnMessage(ev.data);
        } else {
            conn._OnMessage(JSON.parse(ev.data));
        }
    };

    return conn;
}