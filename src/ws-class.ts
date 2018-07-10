/// <reference path="./src.d.ts" />

import { CreateConnToServer, StartServer, ThrottleConnections } from "./conn/serverConn";
import { StreamConnToClass, CreateClassFromConn } from "./conn/connStreams";
import { g } from "./reflection/misc";


if(typeof g.NODE === "undefined") {
    console.warn(`No NODE global value set. Assuming NODE = true.`)
    g.NODE = true;
}

/**
interface ClientTest {
    hi(msg: string): Promise<number>;
}
interface ServerTest extends Bidirect<ServerTest, ClientTest> {
    test(y: string): Promise<number>;
}

// Server
{
    class Server implements ServerTest {
        x = 5;
        client!: ClientTest;
        notPublic = () => { };
        async test(y: string) {
            let x: number = await this.client.hi(y);
            //console.log("call to client.hi", x);
            return 5;
        }
    }
    let server = new Server();
    HostServer(6080, server);
}

// Client
{
    class ClientImpl implements ClientTest {
        async hi(msg: string) {
            return msg.length;
        }
    }
    let server = ConnectToServer<ServerTest>({ host: "localhost", port: 6080, bidirectionController: new ClientImpl() });
    (async () => {
        console.log("call to test", await server.test("you"));
    })();
}
*/

export function HostServer<T extends (BidirectAny<T, any> | ControllerAny<T>)>(port: number, server: T) {
    StartServer(port, conn => {
        StreamConnToClass(conn, server);
    });
}

export function ConnectToServer<T extends (Bidirect<T, any> | Controller<T>)>(
    parameters: {
        port: number;
        host: string;
        // Eh... I can't get the types on this parameter to work (we should be able to know if it should be optional or not,
        //  but we can't, because of https://github.com/Microsoft/TypeScript/issues/25357), so I'll just put it here, and make it always optional.
        bidirectionController?: Exclude<T["client"], undefined>
    }
): T {
    let { bidirectionController, host, port } = parameters;
    let conn = CreateConnToServer(`ws://${host}:${port}`);

    let client = CreateClassFromConn<T>({
        conn: conn,
        bidirectionController: bidirectionController
    } as any);

    return client;
}

export { ThrottleConnections };