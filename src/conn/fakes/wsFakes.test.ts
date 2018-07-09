import { simulateNetwork, createConnPairs, CreateConnToServerFake, DEBUG_ASSIGN_PORT } from "./wsFakes";
import { createPromiseStream, setTimeoutAsync } from "../../controlFlow/promise";
import { StartServer, CreateConnToServer } from "../serverConn";
import { throwIfNotImplementsData, throws, throwsAsync } from "../../reflection/assert";
import { BufferSerialization } from "../bufferSerialization";

if(TEST) {
    describe("wsFakes", () => {
        describe("throws", () => {
            it("simulateNetwork throws", async () => {
                let errorStream = createPromiseStream<Packet>();
                await throwsAsync(async () => {
                    let send = simulateNetwork<number>(() => {
                        throw new Error();
                    }, err => {
                        errorStream.throwErr(err);
                    });

                    send(0);

                    await errorStream.getPromise();
                });
            });

            it("throws on calling send on locally closed connection", async () => {
                let obj = createConnPairs();
                obj.clientConn.Close();
                throws(() => {
                    obj.clientConn.Send({ SourceId: [], DestId: [], Kind: "", Payload: undefined });
                });
            });

            it("throws on calling send on remotely closed connection", async () => {
                let obj = createConnPairs(0);
                obj.clientConn.Close();

                // Latency determines the time close takes to propogate. So, this should always be enough time for the server
                //  to know the client is closed.
                await setTimeoutAsync(100);

                throws(() => {
                    obj.serverConn.Send({ SourceId: [], DestId: [], Kind: "", Payload: undefined });    
                });
            });

            it("throws on reusing a port", () => {
                let port = DEBUG_ASSIGN_PORT();
                throws(() => {
                    StartServer(port, () => {});
                    StartServer(port, () => {});
                });
            });

            it("throws on not supported socket url", () => {
                let port = DEBUG_ASSIGN_PORT();
                StartServer(port, () => {});
                throws(() => {
                    CreateConnToServer(`wss://localhost:${port}`);
                });
            });

            it("throws on fixed port number", () => {
                throws(() => {
                    StartServer(8000, () => {});
                });
            });

            it("throws on no port", () => {
                throws(() => {
                    CreateConnToServerFake("ws://localhost");
                });
            });

            it("throws on not finding port", () => {
                let port = DEBUG_ASSIGN_PORT();
                throws(() => {
                    CreateConnToServerFake(`ws://localhost:${port}`);
                });
            });

            it("throws on invalid BufferSerialization.Received calls", async () => {
                let sendObject = createPromiseStream<Types.AnyAllNoObject>();
                let sendBuffer = createPromiseStream<Uint8Array>();

                let buf = new BufferSerialization(x => sendObject.sendValue(x), x => sendBuffer.sendValue(x));
                buf.Send({ a: new Buffer(0) });

                let obj = await sendObject.getPromise();

                throws(() => {
                    buf.Received(obj);
                });

                buf.Received(new Buffer(0));
                buf.Received(new Buffer(0));

                throws(() => {
                    buf.Received(obj);
                });
            });
        });

        describe("misc", () => {
            it("multiple closes noop", async () => {
                let obj = createConnPairs(0);
                obj.clientConn.Close();
                obj.clientConn.Close();

                obj.serverConn.Close();
                obj.serverConn.Close();

                // Wait for closes to finish
                await setTimeoutAsync(100);
            });

            it("allows various websocket url formats", async () => {
                let port = DEBUG_ASSIGN_PORT();
                let serverReceivedStream = createPromiseStream<Packet>();
                StartServer(port, conn => {
                    conn.Subscribe(packet => {
                        serverReceivedStream.sendValue(packet);
                    });
                });

                let client = CreateConnToServer(`ws://localhost:${port}`);

                client.Send({ DestId: [], SourceId: [], Kind: "test", Payload: undefined });

                // Make sure the server gets it
                {
                    let packet = await serverReceivedStream.getPromise();
                    throwIfNotImplementsData(packet.Kind, "test");
                }
            });
        });

        describe("sanity checks", () => {
            it("starts, accepts clients, and sends both ways", async () => {
                let port = DEBUG_ASSIGN_PORT();
                let serverReceivedStream = createPromiseStream<Packet>();
                StartServer(port, conn => {
                    conn.Subscribe(packet => {
                        serverReceivedStream.sendValue(packet);
                        conn.Send({ DestId: [], SourceId: [], Kind: "reply", Payload: undefined });
                    });
                });

                let clientReceivedStream = createPromiseStream<Packet>();
                let client = CreateConnToServer(`ws://localhost:${port}`);
                client.Subscribe(packet => {
                    clientReceivedStream.sendValue(packet);
                });

                client.Send({ DestId: [], SourceId: [], Kind: "test", Payload: undefined });
                client.Send({ DestId: [], SourceId: [], Kind: "test2", Payload: undefined });

                // Make sure the server gets it
                {
                    let packet = await serverReceivedStream.getPromise();
                    throwIfNotImplementsData(packet.Kind, "test");
                }

                {
                    let packet = await serverReceivedStream.getPromise();
                    throwIfNotImplementsData(packet.Kind, "test2");
                }

                // Make sure the client gets a response
                {
                    // And make sure we can get messages back
                    let packet = await clientReceivedStream.getPromise();
                    throwIfNotImplementsData(packet.Kind, "reply");
                }
            });
        });
    });
}