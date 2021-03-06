import { StartServer, CreateConnToServer } from "./serverConn";
import { StreamConnToClass, CreateClassFromConn, GetCurPacket, GetCurConn } from "./connStreams";
import { DEBUG_ASSIGN_PORT } from "./fakes/wsFakes";
import { ThrowsAsync, SetTimeoutAsync, pchan, Throws, ThrowIfNotImplementsData } from "pchannel";

if(TEST) {
    describe("connStreams", () => {
        describe("Throws", () => {
            it("exceptions through calls", async () => {
                let port = DEBUG_ASSIGN_PORT();

                class Server {
                    fnc(): Promise<void> {
                        throw new Error("test error");
                    }
                }

                StartServer(port, conn => {
                    StreamConnToClass(conn, new Server());
                });


                let clientConn = CreateConnToServer(`ws://localhost:${port}`);

                let server = CreateClassFromConn<Server>({conn: clientConn});

                await ThrowsAsync(async () => {
                    await server.fnc();
                });
            });

            it("exceptions through calls async", async () => {
                let port = DEBUG_ASSIGN_PORT();

                class Server {
                    async fnc() {
                        await SetTimeoutAsync(0);
                        throw new Error("test error");
                    }
                }

                StartServer(port, conn => {
                    StreamConnToClass(conn, new Server());
                });


                let clientConn = CreateConnToServer(`ws://localhost:${port}`);

                let server = CreateClassFromConn<Server>({conn: clientConn});

                await ThrowsAsync(async () => {
                    await server.fnc();
                });
            });

            it("errors through calls async", async () => {
                let port = DEBUG_ASSIGN_PORT();

                class Server {
                    async fnc() {
                        await SetTimeoutAsync(0);
                        throw "test error";
                    }
                }

                StartServer(port, conn => {
                    StreamConnToClass(conn, new Server());
                });


                let clientConn = CreateConnToServer(`ws://localhost:${port}`);

                let server = CreateClassFromConn<Server>({conn: clientConn});

                await ThrowsAsync(async () => {
                    await server.fnc();
                });
            });

            it("on function call that doesn't exist", async () => {
                let port = DEBUG_ASSIGN_PORT();

                class Server { }

                StartServer(port, conn => {
                    StreamConnToClass(conn, new Server());
                });

                let clientConn = CreateConnToServer(`ws://localhost:${port}`);
                let server = CreateClassFromConn<Server>({conn: clientConn});
                await ThrowsAsync(async () => {
                    await (server as any)["test"]();
                });
            });

            it("on function call to non function", async () => {
                let port = DEBUG_ASSIGN_PORT();

                class Server {
                    notAFunction = 5;
                }

                StartServer(port, conn => {
                    StreamConnToClass(conn, new Server());
                });

                let clientConn = CreateConnToServer(`ws://localhost:${port}`);
                let server = CreateClassFromConn({conn: clientConn});
                await ThrowsAsync(async () => {
                    await (server as any)["notAFunction"]();
                });
            });

            it("on function call to property function", async () => {
                let port = DEBUG_ASSIGN_PORT();

                class Server {
                    fnc = () => {};
                }

                StartServer(port, conn => {
                    StreamConnToClass(conn, new Server());
                });

                let clientConn = CreateConnToServer(`ws://localhost:${port}`);
                let server = CreateClassFromConn({conn: clientConn});
                await ThrowsAsync(async () => {
                    await (server as any)["fnc"]();
                });
            });

            it("on return from _VOID special function", async () => {
                let waitForDone = pchan<boolean>();
                let port = DEBUG_ASSIGN_PORT();

                class Server {
                    async what_VOID() {
                        waitForDone.SendValue(true);
                        return 5;
                    }
                }

                StartServer(port, conn => {
                    StreamConnToClass(conn, new Server());
                });

                let clientConn = CreateConnToServer(`ws://localhost:${port}`);
                let server = CreateClassFromConn<Server>({conn: clientConn});

                let result = server.what_VOID();
                await waitForDone.GetPromise();
            });

            it("on invalid extra functions calls", async () => {
                class Server implements Controller<Server> { }

                let server = new Server();
                Throws(() => {
                    let packet = GetCurPacket(server);
                });
                Throws(() => {
                    let conn = GetCurConn(server);
                });
            });
        });
        describe("misc", () => {
            it("ignores then property checks", async () => {
                let port = DEBUG_ASSIGN_PORT();
                StartServer(port, conn => { });
                let clientConn = CreateConnToServer(`ws://localhost:${port}`);
                let server = CreateClassFromConn({conn: clientConn});
                (server as any)["then"];
            });

            it("_VOID code path", async () => {
                let port = DEBUG_ASSIGN_PORT();
                let serverFncStream = pchan<string>();

                class Server implements Controller<Server> {
                    fnc_VOID(text: string): void {
                        serverFncStream.SendValue(text);
                    }
                }

                StartServer(port, conn => {
                    StreamConnToClass(conn, new Server());
                });


                let clientConn = CreateConnToServer(`ws://localhost:${port}`);

                let server = CreateClassFromConn<Server>({conn: clientConn});

                server.fnc_VOID("test");

                let serverValue = await serverFncStream.GetPromise();
                ThrowIfNotImplementsData(serverValue, "test");
            });

            it("controller misc functions", async () => {
                let port = DEBUG_ASSIGN_PORT();

                class Server { }

                StartServer(port, conn => {
                    StreamConnToClass(conn, new Server());
                });

                let clientConn = CreateConnToServer(`ws://localhost:${port}`);

                let server = CreateClassFromConn<Server>({conn: clientConn});

                server.GetConn();
                server.IsDead();
                server.CloseConnection();
            });

            it("misc extra functions", async () => {
                let port = DEBUG_ASSIGN_PORT();

                class Server implements Controller<Server> {
                    async fnc(this: Server, text: string) {
                        let packet = GetCurPacket(this);
                        let conn = GetCurConn(this);
                    }
                }

                StartServer(port, conn => {
                    StreamConnToClass(conn, new Server());
                });


                let clientConn = CreateConnToServer(`ws://localhost:${port}`);

                let server = CreateClassFromConn<Server>({conn: clientConn});

                await server.fnc("test");
            });
        });
        describe("sanity checks", () => {
            it("allows a simple client to server function call", async () => {
                let port = DEBUG_ASSIGN_PORT();
                let serverFncStream = pchan<string>();

                class Server {
                    fnc(text: string) {
                        serverFncStream.SendValue(text);
                    }
                }

                StartServer(port, conn => {
                    StreamConnToClass(conn, new Server());
                });


                let clientConn = CreateConnToServer(`ws://localhost:${port}`);

                let server = CreateClassFromConn<Server>({conn: clientConn});

                server.fnc("test");

                let serverValue = await serverFncStream.GetPromise();
                ThrowIfNotImplementsData(serverValue, "test");
            });

            it("serializes arguments, instead of just passing them through the fake", async () => {
                let port = DEBUG_ASSIGN_PORT();

                class Server {
                    async fnc(obj: {}) {
                        return obj;
                    }
                }

                StartServer(port, conn => {
                    StreamConnToClass(conn, new Server());
                });


                let clientConn = CreateConnToServer(`ws://localhost:${port}`);

                let server = CreateClassFromConn<Server>({conn: clientConn});

                let obj = {};
                let objReturn = await server.fnc(obj);

                // The object shouldn't be === ! A network connection cannot pass an object directly.
                ThrowIfNotImplementsData(obj === objReturn, false);
            });

            it("allows bidrectional calls", async () => {
                let port = DEBUG_ASSIGN_PORT();
                let serverFncStream = pchan<string>();

                interface ServerClient {
                    getValue(): Promise<string>;
                }
                class Server implements Bidirect<Server, ServerClient> {
                    client!: ServerClient;
                    async fnc(text: string) {
                        serverFncStream.SendValue(await this.client.getValue());
                    }
                }

                StartServer(port, conn => {
                    StreamConnToClass(conn, new Server());
                });


                class ServerClientImpl implements ServerClient {
                    async getValue(): Promise<string> {
                        return "okay";
                    }
                }
                let clientConn = CreateConnToServer(`ws://localhost:${port}`);

                let server = CreateClassFromConn<Server>({
                    conn: clientConn,
                    bidirectionController: new ServerClientImpl(),
                });

                server.fnc("test");

                let serverValue = await serverFncStream.GetPromise();
                ThrowIfNotImplementsData(serverValue, "okay");
            });
        });

        describe("basic buffers", () => {
            it("buffer returned works", async () => {
                let port = DEBUG_ASSIGN_PORT();
                let serverFncStream = pchan<string>();

                class Server {
                    async fnc(text: string): Promise<Buffer> {
                        return new Buffer(Array.from(text).map(x => x.charCodeAt(0)));
                    }
                }

                StartServer(port, conn => {
                    StreamConnToClass(conn, new Server());
                });


                let clientConn = CreateConnToServer(`ws://localhost:${port}`);

                let server = CreateClassFromConn<Server>({conn: clientConn});

                let value = await server.fnc("test");
                let isBuffer = value instanceof Buffer;

                ThrowIfNotImplementsData({isBuffer}, {isBuffer: true});

                let resultText = Array.from(value).map(x => String.fromCharCode(x)).join("");
                ThrowIfNotImplementsData(resultText, "test");
            });

            it("buffer argument works", async () => {
                let port = DEBUG_ASSIGN_PORT();
                let serverFncStream = pchan<string>();

                class Server {
                    async fnc(buf: Buffer): Promise<Buffer> {
                        return new Buffer(Array.from(buf).reverse());
                    }
                }

                StartServer(port, conn => {
                    StreamConnToClass(conn, new Server());
                });


                let clientConn = CreateConnToServer(`ws://localhost:${port}`);

                let server = CreateClassFromConn<Server>({conn: clientConn});

                let value = await server.fnc(new Buffer([0, 1, 2, 3]));
                let isBuffer = value instanceof Buffer;

                ThrowIfNotImplementsData({isBuffer}, {isBuffer: true});

                let result = Array.from(value);
                ThrowIfNotImplementsData(result, [3, 2, 1, 0]);
            });

            it("buffer in object as argument works", async () => {
                let port = DEBUG_ASSIGN_PORT();
                let serverFncStream = pchan<string>();

                class Server {
                    async fnc(obj: { buf: Buffer, count: number}): Promise<Buffer> {
                        return new Buffer(Array.from(obj.buf).slice(0, obj.count));
                    }
                }

                StartServer(port, conn => {
                    StreamConnToClass(conn, new Server());
                });


                let clientConn = CreateConnToServer(`ws://localhost:${port}`);

                let server = CreateClassFromConn<Server>({conn: clientConn});

                let value = await server.fnc({buf: new Buffer([0, 1, 2, 3]), count: 2});
                let isBuffer = value instanceof Buffer;

                ThrowIfNotImplementsData({isBuffer}, {isBuffer: true});

                let result = Array.from(value);
                ThrowIfNotImplementsData(result, [0, 1]);
            });

            it("buffer in object returned works", async () => {
                let port = DEBUG_ASSIGN_PORT();
                let serverFncStream = pchan<string>();

                class Server {
                    async fnc(obj: { buf: Buffer, count: number}): Promise<{ buf: Buffer, count: number }> {
                        return { buf: new Buffer(Array.from(obj.buf).slice(0, obj.count)), count: obj.count };
                    }
                }

                StartServer(port, conn => {
                    StreamConnToClass(conn, new Server());
                });


                let clientConn = CreateConnToServer(`ws://localhost:${port}`);

                let server = CreateClassFromConn<Server>({conn: clientConn});

                let value = await server.fnc({buf: new Buffer([0, 1, 2, 3]), count: 2});
                let isBuffer = value.buf instanceof Buffer;
                ThrowIfNotImplementsData({isBuffer}, {isBuffer: true});
                
                let result = Array.from(value.buf);
                ThrowIfNotImplementsData(result, [0, 1]);
            });
        });
    });
}


type ORToAnd<K, T extends K[]> = (
    T
);
function orToAnd<K>() {
    return function<T extends K[]>() {
        return null as any as T;
    }
}

let what = orToAnd<"a"|"b"|"c">()();