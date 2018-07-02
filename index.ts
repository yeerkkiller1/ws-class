// Expose ws indirectly, so the user never has to deal with websockets.

import * as ws from "ws";
import { CreateServerConn, CreateConnToServer } from "./src/conn/serverConn";
import { StreamConnToClass, CreateClassFromConn } from "./src/conn/connStreams";


interface ClientTest {
    hi(msg: string): Promise<number>;
}

//todonext
// Make Bidirectional controllers actually type safe.
//  Hmm... I am almost certain we need to call a function (probably twice) to make
//  bidirectionality safe.
interface ServerTest extends Bidirect<ServerTest, ClientTest> {
    test(y: string): Promise<number>;
}


// Server
{
    class Server implements ServerTest {
        x = 5;
        client!: ClientTest;
        notPublic = () => {

        };
        async test(y: string) {
            let x: number = await this.client.hi(y);
            //console.log("call to client.hi", x);
            return 5;
        }
    }
    let server = new Server();

    let wsServer = new ws.Server({ port: 6080 });
    wsServer.on("connection", connRaw => {
        console.log("Server got connection")
        let conn = CreateServerConn(connRaw);
        StreamConnToClass(conn, server);
    });
    wsServer.on("error", (err) => {
        console.error(err);
    });
}


// Client
{

    class ClientImpl implements ClientTest {
        async hi(msg: string) {
            return msg.length;
        }
    }


    let websocket = new ws("ws://localhost:6080");
    let conn = CreateServerConn(websocket);

    let clientConn = CreateClassFromConn<ServerTest>({
        conn: conn,
        bidirectionController: new ClientImpl()
    } as any);

    (async () => {
        console.log("call to test", await clientConn.test("you"));
    })();
    
    console.log("done sync code");


    todonext
    // We need a websocket test implementation, so we can run tests simulating websockets.
    // Write unit tests, and use wallaby to run them
}
