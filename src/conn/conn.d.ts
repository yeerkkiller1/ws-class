type UnsubscribeId = string;


type SerializableReturnType = (
    Types.AnyAllNoObjectBuffer
);



interface Packet<Payload = (Types.AnyAllNoObjectBuffer), Kind extends string = string> {
    Kind: Kind;

    // Goes from most specific to least specific. You should push to the and, and pop from the end
    //  when doing packet switching.

    // [ControllerAlias, NodeAlias]
    // [ControllerInstanceId, NodeInstanceId]
    // [SequenceNumber, ControllerInstanceId, NodeInstanceId]
    DestId: string[];
    SourceId: string[];

    Payload: Payload;
}

type SerializedError = string;

type PacketFunctionCall = Packet<{
    FncName: string;
    Parameters: {}[];
}, "FunctionCall">;
type PacketFunctionReturn = Packet<{
    Result?: Types.Primitive|void;
    Error?: SerializedError;
}, "FunctionReturn">;
type PacketCloseConnection = Packet<undefined, "CloseConnection">;

type Packets = PacketFunctionCall | PacketFunctionReturn | PacketCloseConnection;
type BetterInherit<Interface extends Implementor, Implementor> = {};
type _Packets = BetterInherit<Packets, Packet<any, string>>;


// We need to use &, as Controller inverts the assignment direction, so this type is assigned to the
//  real type, instead of the other way around.
interface FunctionWeCanUseOverAConn {
    (...args: Types.AnyAndAll[]): Promise<SerializableReturnType>|void;
}


type Controller<T> = {
    [controllerProp in keyof T]: (
        FunctionWeCanUseOverAConn
    );
};

type BiProperties<C extends Controller<C> = any> = {
    client: C | C&ConnExtraProperties | undefined;
    /** The connection of the synchronous current function call (so if your function is async, this may not be set correctly after async portions of code). */
    syncConnection?: Conn;
    /** The packet of the synchronous current function call (so if your function is async, this may not be set correctly after async portions of code). */
    syncPacket?: Packet;
};

type Bidirect<T, C extends Controller<C>> = (
    //Controller<Omit<T, "client">>
    { [key in keyof Omit<T, keyof BiProperties>]: FunctionWeCanUseOverAConn }
    & BiProperties<C>
);


type ControllerAny<T> = {
    [controllerProp in keyof Omit<T, keyof BiProperties>]: (
        T[controllerProp] extends Function
        ? FunctionWeCanUseOverAConn
        : Object | Types.Primitive
    );
};
type BidirectAny<T, C extends Controller<C>> = (
    ControllerAny<Omit<T, keyof BiProperties>>
    & BiProperties<C>
);


interface ControllerExtraProperties {
    RemoteClosed(id: string): void;
}

interface Conn {
    /** callback is called when we receive data. */
    Subscribe(callback: (packet: Packet) => void): UnsubscribeId;
    Unsubscribe(id: UnsubscribeId): void;

    SubscribeOnOpen(id: string, callback: () => void): void;
    UnsubscribeOnOpen(id: UnsubscribeId): void;

    SubscribeOnClose(id: string, callback: () => void): void;
    UnsubscribeOnClose(id: UnsubscribeId): void;

    /** Closing is permenant. */
    Close(): void;

    Send(packet: Packet): void;

    /** Gets the local unique identifier for this connection. This is is not known about remotely (unless we send it remotely).
     *      Also, this is useless clientside. A client likely only has one connection, and with the id being local this is not useful, and may throw clientside.
    */
    GetLocalId(): string;

    IsDead(): boolean;
}

interface ConnExtraProperties {
    GetConn(): Conn;
    CloseConnection(): void;
    IsDead(): boolean;
    ClosePromise: Promise<void>;
}