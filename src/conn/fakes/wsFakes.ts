import { ConnHolder } from "../ConnHolder";
import { throwAsync } from "../../controlFlow/error";

const debugAssignPortMin = 1 << 20;
let currentDebugAssignedPort = debugAssignPortMin;
/** Must be used in ports. */
export function DEBUG_ASSIGN_PORT(): number {
    return currentDebugAssignedPort++;
}

let servers: {
    [port: number]: {
        onConn(serverConn: Conn): void;
    }
} = {};

export function simulateNetwork<T>(output: (val: T) => void, onError: (err: any) => void, latencyMs = 100, msPerVal = 10): (val: T) => void {
    let valSchedule: {
        val: T;
        time: number;
    }[] = [];
    let newestScheduleTime = +new Date();

    let pendingSchedule = false;
    function waitForScheduledTime(time: number) {
        if(pendingSchedule) {
            return;
        }
        pendingSchedule = true;
        setTimeout(() => {
            let schedule = valSchedule.shift();
            if(!schedule) {
                /* ignore coverage */ throw new Error(`No schedule, this should be impossible`);
            }

            try {
                output(schedule.val);
            } catch(e) {
                onError(e);
            }

            pendingSchedule = false;
            if(valSchedule.length > 0) {
                waitForScheduledTime(valSchedule[0].time);
            }
        }, +new Date() - time);
    }

    return (val) => {
        let curTime = +new Date();

        let latencyTime = curTime + latencyMs;
        let minBandwidthTime = newestScheduleTime + latencyMs;

        let time = Math.max(latencyTime, minBandwidthTime);

        valSchedule.push({
            val,
            time
        });

        waitForScheduledTime(time);
    };
}

/** Creates two connections that send messages to each other, simulating a network connection between them. */
export function createConnPairs(
    latencyMs: number = 100
): {
    clientConn: Conn;
    serverConn: Conn;
} {
    /*
        private send: (packet: Packet) => void,
        private close: () => void,
        private isDefinitelyDead = () => false,
        private id = randomUID("ConnHolder_"),
        private isOpen = true
    */

    let clientConn: ConnHolder;
    let clientReceive: (obj: Types.AnyAllNoObject | Buffer) => void;
    
    let serverConn: ConnHolder;
    let serverReceive: (packet: Types.AnyAllNoObject | Buffer) => void;

    let clientClosed = false;
    let serverClosed = false;

    function throwOnConnClosed(connFactory: () => ConnHolder, targetFactory: () => (packet: Types.AnyAllNoObject | Buffer) => void) {
        let target: (packet: Types.AnyAllNoObject | Buffer) => void;
        let conn: ConnHolder;
        return (packet: Types.AnyAllNoObject | Buffer) => {
            conn = conn || connFactory();
            if(conn.IsDead()) {
                throw new Error(`Cannot send packet on closed connection`);
            }
            target = target || targetFactory();

            if(packet instanceof Buffer) {
                target(packet);
                //target(new Buffer(packet));
            } else {
                packet = JSON.parse(JSON.stringify(packet));
                target(packet);
            }
        }
    }

    clientReceive = throwOnConnClosed(() => serverConn, () => simulateNetwork(clientConn._OnMessage.bind(clientConn), throwAsync, latencyMs));
    serverReceive = throwOnConnClosed(() => clientConn, () => simulateNetwork(serverConn._OnMessage.bind(serverConn), throwAsync, latencyMs));


    let closeFromClient = () => {
        setTimeout(() => {
            clientClosed = true;
        }, latencyMs);
    };
    let isDefinitelyDeadFromClient = () => serverClosed;

    let closeFromServer = () => {
        setTimeout(() => {
            serverClosed = true;
        }, latencyMs);
    };
    let isDefinitelyDeadFromServer = () => clientClosed;

    clientConn = new ConnHolder(
        serverReceive,
        serverReceive,
        closeFromClient,
        isDefinitelyDeadFromClient
    );
    
    serverConn = new ConnHolder(
        clientReceive,
        clientReceive,
        closeFromServer,
        isDefinitelyDeadFromServer
    );

    return {
        clientConn,
        serverConn,
    };
}

export function StartServerFake(port: number, onConn: (conn: Conn) => void): void {
    if(port < debugAssignPortMin) {
        throw new Error(`Test websockets should use ports from DEBUG_ASSIGN_PORT, as using fixed ports will break when running tests in parallel`);
    }
    if(port in servers) {
        throw new Error(`Server on port already exists. Port ${port}`);
    }

    servers[port] = { onConn };
}


// ws://localhost:8080/path/path/path
export function CreateConnToServerFake(url: string): Conn {
    if(!url.startsWith("ws://")) {
        throw new Error(`Only ws:// supported`);
    }
    url = url.substr("ws://".length);
    let colonIndex = url.indexOf(":");
    if(colonIndex < 0) {
        throw new Error(`Port must be passed in url (default port 80 is not supported in fakes).`);
    }
    let host = url.substr(0, colonIndex);
    url = url.substr(colonIndex + 1);

    let pathIndex = url.indexOf("/");
    if(pathIndex < 0) {
        pathIndex = url.length;
    }

    let port = +(url.substr(0, pathIndex));
    let path = url.substr(pathIndex);

    if(!(port in servers)) {
        throw new Error(`Cannot find server with port. Port ${port}`);
    }

    let { clientConn, serverConn } = createConnPairs();

    servers[port].onConn(serverConn);
    
    return clientConn;
}