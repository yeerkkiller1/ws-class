import { randomUID } from "./ConnHolder";
import { pchan, PChan } from "pchannel";

export function GetCurPacket<T extends Controller<T>>(baseController: T): Packet {
    let controller = baseController as any as BiProperties;

    if(controller.syncPacket === undefined) {
        throw new Error(`Tried to get current packet from controller when there is no active synchronous function.`);
    }

    return controller.syncPacket;
}

export function GetCurConn<T extends Controller<T>>(baseController: T): Conn {
    let controller = baseController as any as BiProperties;

    if(controller.syncConnection === undefined) {
        throw new Error(`Tried to get current connection from controller when there is no active synchronous function.`);
    }

    return controller.syncConnection;
}


let controllerCache: {
    [instanceId: string]: Controller<{}> & ConnExtraProperties;
} = {};

const uniqueIdCacheKey = Symbol();
function GetObjectUniqueId(obj: object & { [uniqueIdCacheKey]: string }): string {
    if(!(uniqueIdCacheKey in obj)) {
        obj[uniqueIdCacheKey] = randomUID("object");
    }
    return obj[uniqueIdCacheKey];
}

export function CreateClassFromConn<
    T extends (Bidirect<T, any> | Controller<T>)
>(
    parameters: (
        T extends { client: any } ? {
            conn: Conn,
            bidirectionController: Exclude<T["client"], undefined>,
            destId?: string[]
        } : {
            conn: Conn,
            bidirectionController?: never,
            destId?: string[]
        }
    )
): T & ConnExtraProperties {
    let { conn, destId, bidirectionController } = parameters;

    let hashParts: Types.AnyAll[] = [conn.GetLocalId(), destId];
    if(bidirectionController) {
        let id = GetObjectUniqueId(bidirectionController);
        hashParts.push(id);
    }
    let hashId = JSON.stringify(hashParts);
    if(!controllerCache[hashId]) {
        controllerCache[hashId] = CreateClassFromConnInternal(parameters);
    }

    return controllerCache[hashId] as T & ConnExtraProperties;
}

function CreateClassFromConnInternal<
    T extends (Bidirect<T, any> | Controller<T>)
>(
    parameters: (
        T extends { client: any } ? {
            conn: Conn,
            bidirectionController: T["client"],
            destId?: string[]
        } : {
            conn: Conn,
            bidirectionController?: never,
            destId?: string[]
        }
    ),
): T & ConnExtraProperties {
    let { conn, destId, bidirectionController } = parameters;

    console.log(`CreateClassFromConnInternal conn: ${conn.GetLocalId()}, destid: ${destId}`);

    let nextSequenceNumber: number = 0;

    function send(packet: Packets) {
        conn.Send(packet);
    }

    if (bidirectionController) {
        StreamConnToClass(conn, bidirectionController, true);
    }

    let functionCallbacks: {
        [id: string]: {
            promise: Promise<SerializableReturnType|void>,
            resolve: (obj: SerializableReturnType|void ) => void,
            reject: (error: SerializedError) => void
        }
    } = {};

    function createHandler(name: string): (
        (this: BiProperties, ...args: any[]) => Promise<SerializableReturnType> | void
    ) {
        // Idk... people are trying to determine if we are a promise?
        if(name === "then") {
            return undefined as any;
        }

        function getDestId(this: BiProperties) {
            if(!destId) {
                return [];
            }
            return destId.slice();
        }

        if(name.endsWith("_VOID")) {
            return function(this: BiProperties, ...args: any[]) {
                send({
                    Kind: "FunctionCall",
                    DestId: getDestId.call(this),
                    SourceId: [],
                    Payload: {
                        FncName: name,
                        Parameters: args
                    }
                });
            };
        }

        return function(this: BiProperties, ...args: any[]) {
            let sequenceId = nextSequenceNumber++;
            let resolve: (obj: SerializableReturnType|void) => void = undefined as any;
            let reject: (error: SerializedError) => void = undefined as any;
            let promise = new Promise<SerializableReturnType|void>((_resolve, _reject) => {
                resolve = _resolve;
                reject = _reject;
            });
            
            functionCallbacks[sequenceId] = { promise, resolve, reject };
            send({
                Kind: "FunctionCall",
                DestId: getDestId.call(this),
                SourceId: [sequenceId + ""],
                Payload: {
                    FncName: name,
                    Parameters: args
                }
            });
            return promise;
        };
    }

    function getProxy(target: Controller<T>, name: keyof T) {
        if(!(name in target)) {
            // Lol, this type failure is actually pretty correct.
            target[name] = createHandler(String(name));
        }
        return target[name];
    }

    conn.Subscribe(packetAny => {
        let packet = packetAny as Packets;
        switch(packet.Kind) {
            // ignore coverage
            default: throw new Error("Packet Kind not implemented " + (packet as any).Kind);
            case "FunctionCall": break;
            case "FunctionReturn":
                let sequenceId = packet.DestId[0];
                let callback = functionCallbacks[sequenceId];

                //console.log("Received FunctionReturn. From", packet.DestId, "To", packet.SourceId, "Kind", packet.Kind, "Value", JSON.stringify(packet.Payload).slice(0, 200));
                // ignore coverage
                if(!callback) {
                    console.error("Received FunctionReturn with sequenceId we either already received, or that does not exist. From", packet.DestId, "To", packet.SourceId, "Kind", packet.Kind, "Value", JSON.stringify(packet.Payload).slice(0, 200));
                    return;
                }
                let payload = packet.Payload;
                if(payload.Error !== undefined) {
                    callback.reject(payload.Error);
                } else {
                    callback.resolve(payload.Result);
                }
                break;
        }
    });
    
    let closeChan = new PChan<void>();
    conn.SubscribeOnClose("connStreams", () => {
        closeChan.SendValue(undefined);
    });
    var controller = new Proxy<ConnExtraProperties>({
        GetConn() {
            return conn;
        },
        CloseConnection() {
            send({
                DestId: [],
                SourceId: [],
                Kind: "CloseConnection",
                Payload: undefined
            });
        },
        IsDead() {
            return conn.IsDead();
        },
        ClosePromise: closeChan.GetPromise()
    }, {
        get: getProxy as any
    });

    return controller as any;
}

export function StreamConnToClass<
    T extends (BidirectAny<T, any> | ControllerAny<T>)
>(
    conn: Conn,
    /** All functions on the __proto__ of this are exposed, so any functions that don't return void or a Promis are disallowed. */
    instance: T,
    biClass = false
): void {

    //console.log(`StreamConnToClass from ${conn.GetLocalId()}, ${JSON.stringify({biClass})}`);

    // Every class has a bidirectional controller, as we can't check if it needs to be directional or not
    //  from the given T type parameter (as that is just a type), or from instance (as the user doesn't do any bidirectional
    //  initialization or setting that we can detect.)

    // We have a controller per source path?
    // But... in CreateClassFromConn we use an id we hook up with the connection object.
    // That could work... but then I think we need to make the connection handle packet switching?,
    //  which I think is currently done by maestro, which makes sense as knowing where something goes
    //  ties into knowing what should exist. So maybe we shouldn't do packet switching at all?
    //  I think maestro has some connections that send paths that it interprets, and then it makes
    //  connections with no paths from those? Check that, and maybe path stuff shouldn't actually
    //  happen at the connection level?

    let biControllerCache: {
        [sourceHash: string]: Controller<any>
    } = {};
    function getBiController(packet: Packets): Controller<any> {
        // Skip the first part of the sourceId, as that is specific to the function call.
        let dest = packet.SourceId.slice(1);
        let destHash = JSON.stringify(dest);
        if(!(destHash in biControllerCache)) {
            //console.log(`Call CreateClassFromConn from ${conn.GetLocalId()}`)
            biControllerCache[destHash] = CreateClassFromConn<any>({
                conn: conn,
                destId: dest,
            });
        }
        return biControllerCache[destHash];
    }

    conn.Subscribe(packetAny => {
        let packet = packetAny as Packets;

        function sendReturn(obj: Types.AnyAllNoObject | Types.AnyAllNoObjectBuffer) {
            conn.Send({
                SourceId: [],
                DestId: packet.SourceId,
                Kind: "FunctionReturn",
                Payload: {
                    Result: obj
                }
            });
        }
        function sendErr(errText: string) {
            conn.Send({
                SourceId: [],
                DestId: packet.SourceId,
                Kind: "FunctionReturn",
                Payload: {
                    Error: errText
                }
            });
        }

        switch(packet.Kind) {
            // ignore coverage
            default: throw new Error("Packet Kind not implemented " + (packet as any).Kind);
            case "FunctionReturn": break;
            case "CloseConnection":
                conn.Close();
                break;
            case "FunctionCall":
                let payload = packet.Payload;
                let fncName = payload.FncName as keyof Omit<T, "client">;

                let biInstance = instance as BiProperties;

                let result: Promise<SerializableReturnType>|undefined = undefined;
                let error: Error|undefined = undefined;    
                try {
                    if(!(fncName in instance)) throw new Error("Cannot find function " + fncName);


                    let instanceType = instance as Controller<any>;
                    let prop: Types.AnyAll|Function = instanceType[fncName];
                    if(typeof prop !== "function") {
                        throw new Error(`Tried to call non function ${fncName}`);
                    }

                    let proto = (instance as any)["__proto__"];
                    if(!(fncName in proto) || typeof proto[fncName] !== "function") {
                        throw new Error(`Remote tried to call function that existed in instance, but is not a function in __proto__. This means the function wasn't meant to be exposed, and is just a property on the object. Fnc name: ${fncName}`);
                    }

                    if(!biClass) {
                        biInstance.client = getBiController(packet);
                    }
                    biInstance.syncConnection = conn;
                    biInstance.syncPacket = packet;

                    // Call function with the instance context, with client set correctly.
                    let fnc: Function = prop;
                    result = fnc.apply(instance, payload.Parameters);

                    if(String(fncName).endsWith("_VOID")) {
                        if(result) {
                            console.error(`Cannot return a result from a function ending with _VOID. These are special functions that do not have return values (to save packets). Tried to return ${result}.`);
                        }
                        // We can't throw, as the client isn't even listening for the result, so they won't have anywhere to throw the error.
                        return;
                    }
                } catch(e) {
                    console.error(`Error in fnc ${fncName}: ${e}`, e);
                    error = e;
                }
                finally {
                    biInstance.client = undefined;
                    biInstance.syncConnection = undefined;
                    biInstance.syncPacket = undefined;
                }

                if(error !== undefined) {
                    sendErr(error.stack + "");
                } else {
                    if(!result) {
                        sendReturn(result);
                    } else {
                        result
                            .then(result => {
                                sendReturn(result);
                            })
                            .catch(error => {
                                let errorText = (error && error.stack || error) + "";
                                sendErr(errorText);
                            });
                        ;
                    }
                }
                break;
        }
    });
}