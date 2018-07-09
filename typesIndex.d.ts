/// <reference path="src/conn/conn.d.ts" />
/// <reference path="src/conn/types.d.ts" />
/// <reference path="src/reflection/reflection.d.ts" />
declare module "src/reflection/type" {
    export function isNumber(str: string): boolean;
    export function isInteger(num: number): boolean;
    export function isPrimitive(value: Types.AnyAll): value is Types.Primitive;
    /** As in, {} can have children. But null can't. Also, function(){} doesn't count. Yes, it can have children, but it is more likely a mistake. */
    export function canHaveChildren(value: Types.AnyAll): value is Types.Dictionary;
    export function isArray(obj: Types.AnyAll): obj is Types.Arr;
}
declare module "src/controlFlow/map" {
    export function mapRecursive<O extends Types.AnyAll>(obj: Types.AnyAllNoObjectBuffer, map: (t: Types.AnyAllNoObjectBuffer) => {
        terminalLeaf: O;
    } | "recurse"): O;
}
declare module "src/conn/bufferSerialization" {
    export class BufferSerialization<T extends ({
        [key in keyof T]: Types.AnyAllNoObjectBuffer;
    } | Types.AnyAllNoObjectBuffer)> {
        private sendObject;
        private sendBuffer;
        constructor(sendObject: (packet: Types.AnyAllNoObject) => void, sendBuffer: (packet: Uint8Array) => void);
        pendingBuffers: Uint8Array[];
        Received(obj: Types.AnyAllNoObject | Uint8Array): {
            obj: T;
        } | null;
        Send(obj: T): void;
        private send;
    }
}
declare module "src/conn/ConnHolder" {
    import { BufferSerialization } from "src/conn/bufferSerialization";
    export function randomUID(prefix?: string): string;
    export class ConnHolder implements Conn {
        private sendObject;
        private sendBuffer;
        private close;
        private isDefinitelyDead;
        private id;
        private isOpen;
        constructor(sendObject: (packet: Types.AnyAllNoObject) => void, sendBuffer: (packet: Uint8Array) => void, close: () => void, isDefinitelyDead?: () => boolean, id?: string, isOpen?: boolean);
        bufferSerialization: BufferSerialization<Packet<Types.MakeArr<string | number | boolean | void | Uint8Array | {
            [x: string]: Types.MakeArr<string | number | boolean | void | Uint8Array | any | null | undefined>;
        } | null | undefined>, string>>;
        GetLocalId(): string;
        closeCalled: boolean;
        nextCallbackId: number;
        callbacks: {
            [id: string]: (packet: Packet) => void;
        };
        Subscribe(callback: (packet: Packet) => void): UnsubscribeId;
        Unsubscribe(id: UnsubscribeId): void;
        _OnMessage(inputObj: Types.AnyAllNoObject | Uint8Array): void;
        callbacksOnOpen: {
            [id: string]: () => void;
        };
        SubscribeOnOpen(callbackId: string, callback: () => void): void;
        UnsubscribeOnOpen(id: UnsubscribeId): void;
        queuedPackets: Packet[];
        _OnOpen(): void;
        Send(packet: Packet): void;
        callbacksOnClose: {
            [id: string]: () => void;
        };
        SubscribeOnClose(callbackId: string, callback: () => void): void;
        UnsubscribeOnClose(id: UnsubscribeId): void;
        _OnClose(): void;
        /** Closing is permenant. If you call Close, Reconnect MUST not reconnect. */
        Close(): void;
        IsDead(): boolean;
    }
}
declare module "src/controlFlow/error" {
    export function throwAsync(err: any): void;
}
declare module "src/conn/fakes/wsFakes" {
    /** Must be used in ports. */
    export function DEBUG_ASSIGN_PORT(): number;
    export function simulateNetwork<T>(output: (val: T) => void, onError: (err: any) => void, latencyMs?: number, msPerVal?: number, sizePerVal?: (val: T) => number): (val: T) => void;
    /** Creates two connections that send messages to each other, simulating a network connection between them. */
    export function createConnPairs(latencyMs?: number): {
        clientConn: Conn;
        serverConn: Conn;
    };
    export function StartServerFake(port: number, onConn: (conn: Conn) => void): void;
    export function CreateConnToServerFake(url: string): Conn;
}
declare module "src/controlFlow/promise" {
    export function createPromiseStream<T>(promiseErrorTimeout?: number): {
        getPromise(): Promise<T>;
        sendValue(val: T | Promise<T>): void;
        throwErr(err: any): void;
    };
    export function setTimeoutAsync(time: number): Promise<void>;
}
declare module "src/conn/serverConn" {
    export function StartServer(port: number, onConn: (conn: Conn) => void): void;
    interface ThrottleInfo {
        latencyMs: number;
        kbPerSecond: number;
    }
    export function ThrottleConnections(newThrottleInfo: ThrottleInfo, code: () => void): void;
    export function CreateConnToServer(url: string): Conn;
}
declare module "src/conn/connStreams" {
    export function GetCurPacket<T extends Controller<T>>(baseController: T): Packet;
    export function GetCurConn<T extends Controller<T>>(baseController: T): Conn;
    export function CreateClassFromConn<T extends (Bidirect<T, any> | Controller<T>)>(parameters: (T extends {
        client: any;
    } ? {
        conn: Conn;
        bidirectionController: Exclude<T["client"], undefined>;
        destId?: string[];
    } : {
        conn: Conn;
        bidirectionController?: never;
        destId?: string[];
    })): T & ConnExtraProperties;
    export function StreamConnToClass<T extends (BidirectAny<T, any> | ControllerAny<T>)>(conn: Conn, 
    /** All functions on the __proto__ of this are exposed, so any functions that don't return void or a Promis are disallowed. */
    instance: T, biClass?: boolean): void;
}
declare module "ws-class" {
    import { ThrottleConnections } from "src/conn/serverConn";
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
            notPublic = () => {
    
            };
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
    export function HostServer<T extends (BidirectAny<T, any> | ControllerAny<T>)>(port: number, server: T): void;
    export function ConnectToServer<T extends (Bidirect<T, any> | Controller<T>)>(parameters: {
        port: number;
        host: string;
        bidirectionController?: Exclude<T["client"], undefined>;
    }): T;
    export { ThrottleConnections };
}
declare module "src/conn/browserConn" { }
declare module "src/reflection/misc" {
    export let g: any;
    export function isEmpty<T>(obj: {
        [key: string]: T;
    }): boolean;
}
declare module "src/format/stringify" {
    /** Creates something that looks like a javascript object, sort of. */
    export function JSONStringifyDangerousPretty(obj: Types.AnyAll, 
    /** Inclusive */
    maxCharsPerLine?: number, indentCount?: number): string;
}
declare module "src/reflection/assert" {
    /** Pass a value/object/anything into this, and then into a dataContract of throwIfNotImplementsData, and it will be optional in the data contract. */
    export function opt<T extends Types.AnyAll>(value: T): T;
    export function objectExact<T extends Types.AnyAll>(value: T): T;
    export function anyOrder<T extends Types.AnyAll>(value: T): T;
    export function p(pathString: string): string[];
    export function ph(pathString: string): string;
    /** Path array. Just an array of paths. Makes [p("a"), p("b"), p("c")] into pa("a", "b", "c") */
    export function pa(...pathStrings: string[]): string[][];
    export function throwIfNotImplementsData(proposedData: Types.AnyAll, dataContract: Types.AnyAll): void;
    /** AKA, is not compatible with.
     *
     *      INVERSE OF (Says if the proposedData has every property and with the same value as dataContract. Ignores extra properties in proposedData,
     *          unless the properties are in arrays (or it could be said, it throws property called "length" differs))
     *
     * Returns false if it is compatible with, and an array of the first incompatible path if it isn't compatible with.
     *
     * [undefined] is compatible with [], because that makes optional values easier to implement.
    */
    export function notImplementsData(proposedData: Types.AnyAll, dataContract: Types.AnyAll): false | string[];
    export function throws(code: () => void): void;
    export function throwsAsync(code: () => Promise<void>): Promise<void>;
}
declare module "src/conn/connStreams.test" { }
declare module "src/conn/fakes/wsFakes.test" { }
declare module "src/reflection/type.test" { }
