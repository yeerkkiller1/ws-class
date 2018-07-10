import { simulateNetwork, createConnPairs, CreateConnToServerFake, DEBUG_ASSIGN_PORT } from "./wsFakes";
import { StartServer, CreateConnToServer } from "../serverConn";
import { BufferSerialization } from "../bufferSerialization";
import { ThrowsAsync, Throws, SetTimeoutAsync, pchan, ThrowIfNotImplementsData } from "pchannel";

if(TEST) {
    describe("wsFakes", () => {
        describe("throws", () => {
            it("simulateNetwork throws", async () => {
                let errorStream = pchan<Packet>();
                await ThrowsAsync(async () => {
                    let send = simulateNetwork<number>(() => {
                        throw new Error();
                    }, err => {
                        errorStream.SendError(err);
                    });

                    send(0);

                    await errorStream.GetPromise();
                });
            });

            it("throws on calling send on locally closed connection", async () => {
                let obj = createConnPairs();
                obj.clientConn.Close();
                Throws(() => {
                    obj.clientConn.Send({ SourceId: [], DestId: [], Kind: "", Payload: undefined });
                });
            });

            it("throws on calling send on remotely closed connection", async () => {
                let obj = createConnPairs(0);
                obj.clientConn.Close();

                // Latency determines the time close takes to propogate. So, this should always be enough time for the server
                //  to know the client is closed.
                await SetTimeoutAsync(100);

                Throws(() => {
                    obj.serverConn.Send({ SourceId: [], DestId: [], Kind: "", Payload: undefined });    
                });
            });

            it("throws on reusing a port", () => {
                let port = DEBUG_ASSIGN_PORT();
                Throws(() => {
                    StartServer(port, () => {});
                    StartServer(port, () => {});
                });
            });

            it("throws on not supported socket url", () => {
                let port = DEBUG_ASSIGN_PORT();
                StartServer(port, () => {});
                Throws(() => {
                    CreateConnToServer(`wss://localhost:${port}`);
                });
            });

            it("throws on fixed port number", () => {
                Throws(() => {
                    StartServer(8000, () => {});
                });
            });

            it("throws on no port", () => {
                Throws(() => {
                    CreateConnToServerFake("ws://localhost");
                });
            });

            it("throws on not finding port", () => {
                let port = DEBUG_ASSIGN_PORT();
                Throws(() => {
                    CreateConnToServerFake(`ws://localhost:${port}`);
                });
            });

            it("throws on invalid BufferSerialization.Received calls", async () => {
                let sendObject = pchan<Types.AnyAllNoObject>();
                let sendBuffer = pchan<Uint8Array>();

                let buf = new BufferSerialization(x => sendObject.SendValue(x), x => sendBuffer.SendValue(x));
                buf.Send({ a: new Buffer(0) });

                let obj = await sendObject.GetPromise();

                Throws(() => {
                    buf.Received(obj);
                });

                buf.Received(new Buffer(0));
                buf.Received(new Buffer(0));

                Throws(() => {
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
                await SetTimeoutAsync(100);
            });

            it("allows various websocket url formats", async () => {
                let port = DEBUG_ASSIGN_PORT();
                let serverReceivedStream = pchan<Packet>();
                StartServer(port, conn => {
                    conn.Subscribe(packet => {
                        serverReceivedStream.SendValue(packet);
                    });
                });

                let client = CreateConnToServer(`ws://localhost:${port}`);

                client.Send({ DestId: [], SourceId: [], Kind: "test", Payload: undefined });

                // Make sure the server gets it
                {
                    let packet = await serverReceivedStream.GetPromise();
                    ThrowIfNotImplementsData(packet.Kind, "test");
                }
            });
        });

        describe("sanity checks", () => {
            it("starts, accepts clients, and sends both ways", async () => {
                let port = DEBUG_ASSIGN_PORT();
                let serverReceivedStream = pchan<Packet>();
                StartServer(port, conn => {
                    conn.Subscribe(packet => {
                        serverReceivedStream.SendValue(packet);
                        conn.Send({ DestId: [], SourceId: [], Kind: "reply", Payload: undefined });
                    });
                });

                let clientReceivedStream = pchan<Packet>();
                let client = CreateConnToServer(`ws://localhost:${port}`);
                client.Subscribe(packet => {
                    clientReceivedStream.SendValue(packet);
                });

                client.Send({ DestId: [], SourceId: [], Kind: "test", Payload: undefined });
                client.Send({ DestId: [], SourceId: [], Kind: "test2", Payload: undefined });

                // Make sure the server gets it
                {
                    let packet = await serverReceivedStream.GetPromise();
                    ThrowIfNotImplementsData(packet.Kind, "test");
                }

                {
                    let packet = await serverReceivedStream.GetPromise();
                    ThrowIfNotImplementsData(packet.Kind, "test2");
                }

                // Make sure the client gets a response
                {
                    // And make sure we can get messages back
                    let packet = await clientReceivedStream.GetPromise();
                    ThrowIfNotImplementsData(packet.Kind, "reply");
                }
            });
        });
    });
}